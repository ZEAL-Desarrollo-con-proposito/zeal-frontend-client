import { act, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { EMPLOYEE_PATHS, ROLE_HOME_PATH } from '@/app/paths';
import { UNREGISTERED_ACCOUNT } from '@/mocks/microsoft/handlers';
import { server } from '@/mocks/server';
import { seedUser } from '@/test/credentials';
import { loginWithMicrosoft, spyPageNavigation } from '@/test/microsoftLogin';
import { renderRoute } from '@/test/renderRoute';
import { LOGOUT_ENDPOINT, MICROSOFT_LOGIN_ENDPOINT } from '../api/authApi';
import { PENDING_LOGOUT_KEY } from '../api/sessionLifecycle';
import type { Role } from '../model/session';

const MICROSOFT_BUTTON = 'Iniciar sesión con Microsoft';

function microsoftButton() {
  return screen.getByRole('button', { name: MICROSOFT_BUTTON });
}

describe('Inicio de sesión con Microsoft', () => {
  it.each<[Role, string]>([
    ['EMPLEADO', 'Hola, David'],
    ['PSICOLOGO', 'Mi agenda'],
    ['ADMIN', 'Hola, Talento'],
  ])('lleva al usuario %s a su pantalla de llegada', async (role, greeting) => {
    const view = await renderRoute('/login');

    const { router } = await loginWithMicrosoft(view, seedUser(role).email);

    expect(await screen.findByRole('heading', { name: greeting })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(ROLE_HOME_PATH[role]);
  });

  it('no pide contraseña: la protege Microsoft', async () => {
    await renderRoute('/login');

    expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument();
    expect(
      screen.getByText('Tu contraseña la protege Microsoft: ZEAL nunca la ve ni la guarda.'),
    ).toBeInTheDocument();
  });

  it('vuelve a la pantalla que se quería abrir', async () => {
    const view = await renderRoute(EMPLOYEE_PATHS.appointments);
    await waitFor(() => {
      expect(view.router.state.location.pathname).toBe('/login');
    });

    const { router } = await loginWithMicrosoft(view, seedUser('EMPLEADO').email);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(EMPLOYEE_PATHS.appointments);
    });
  });

  it('una cuenta de Microsoft sin acceso a ZEAL vuelve al login con la explicación', async () => {
    const view = await renderRoute('/login');

    const { router } = await loginWithMicrosoft(view, UNREGISTERED_ACCOUNT);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esa cuenta de Microsoft no tiene acceso a ZEAL.',
    );
    expect(router.state.location.pathname).toBe('/login');
  });

  it('si la persona cancela en Microsoft, lo dice y deja intentarlo de nuevo', async () => {
    const navigation = spyPageNavigation();
    const view = await renderRoute('/login');
    await view.user.click(microsoftButton());
    const picker = await navigation.leave(view, 1);

    await picker.user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await navigation.leave(picker, 2);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cancelaste el inicio de sesión con Microsoft.',
    );
    expect(microsoftButton()).toBeEnabled();
  });

  it('un regreso repetido o inventado no inicia sesión', async () => {
    const navigation = spyPageNavigation();
    const picker = await renderRoute('/simulador/microsoft?state=inventado');

    await picker.user.click(await screen.findByRole('button', { name: /David Cajamarca/ }));
    await navigation.leave(picker, 1);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos iniciar sesión con Microsoft.',
    );
  });

  it('un código de error desconocido en la dirección no se pinta tal cual', async () => {
    await renderRoute('/login?error=%3Cscript%3Ealert(1)%3C%2Fscript%3E');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No pudimos iniciar sesión con Microsoft. Intenta de nuevo.',
    );
    expect(screen.queryByText(/script/)).not.toBeInTheDocument();
  });

  it('le dice al servidor si debe recordar la sesión y a dónde volver', async () => {
    let received: unknown = null;
    server.use(
      http.post(`*${MICROSOFT_LOGIN_ENDPOINT}`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ authorizationUrl: 'https://login.microsoftonline.com/x' });
      }),
    );
    const navigation = spyPageNavigation();
    const view = await renderRoute('/login');

    await view.user.click(screen.getByRole('checkbox', { name: 'Recordarme' }));
    await view.user.click(microsoftButton());

    expect(await navigation.target()).toBe('https://login.microsoftonline.com/x');
    expect(received).toEqual({ remember: true, returnTo: '/login' });
  });

  it('bloquea el botón mientras abre Microsoft y lo libera si la persona vuelve con "Atrás"', async () => {
    const navigation = spyPageNavigation();
    const view = await renderRoute('/login');

    await view.user.click(microsoftButton());
    await navigation.target();
    const opening = screen.getByRole('button', { name: 'Abriendo Microsoft…' });
    expect(opening).toBeDisabled();

    // Una visita normal no cambia nada; restaurar la página desde la caché del navegador sí.
    act(() => {
      window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: false }));
    });
    expect(opening).toBeDisabled();
    act(() => {
      window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    });
    expect(microsoftButton()).toBeEnabled();
  });

  it.each([
    [
      'no está disponible',
      () => new HttpResponse(null, { status: 503 }),
      'ZEAL no está disponible en este momento.',
    ],
    ['no hay conexión', () => HttpResponse.error(), 'No pudimos conectar con ZEAL.'],
  ])('si el servidor %s, lo avisa y deja intentarlo de nuevo', async (_case, resolver, text) => {
    server.use(http.post(`*${MICROSOFT_LOGIN_ENDPOINT}`, resolver, { once: true }));
    const view = await renderRoute('/login');

    await view.user.click(microsoftButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(microsoftButton()).toBeEnabled();
  });

  it('un cierre de sesión pendiente se completa antes de ir a Microsoft', async () => {
    let revocations = 0;
    server.use(
      http.post(`*${LOGOUT_ENDPOINT}`, () => {
        revocations += 1;
        return revocations === 1 ? HttpResponse.error() : new HttpResponse(null, { status: 204 });
      }),
    );
    localStorage.setItem(PENDING_LOGOUT_KEY, 'true');
    const navigation = spyPageNavigation();
    const view = await renderRoute('/login');
    await waitFor(() => {
      expect(revocations).toBe(1);
    });

    await view.user.click(microsoftButton());

    await navigation.target();
    expect(revocations).toBe(2);
    expect(localStorage.getItem(PENDING_LOGOUT_KEY)).toBeNull();
  });
});
