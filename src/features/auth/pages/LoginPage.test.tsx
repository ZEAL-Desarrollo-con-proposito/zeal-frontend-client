import { act, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPLOYEE_PATHS, ROLE_HOME_PATH } from '@/app/paths';
import { UNREGISTERED_ACCOUNT } from '@/mocks/microsoft/handlers';
import { LOGIN_MAX_FAILURES, registerFailedLogin } from '@/mocks/microsoft/loginThrottle';
import { server } from '@/mocks/server';
import { controlClock } from '@/test/clock';
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

describe('Bloqueo por fuerza bruta (SEG-1)', () => {
  const LOCKOUT_TEXT =
    'El acceso desde esta red está bloqueado temporalmente por demasiados intentos.';

  beforeEach(() => {
    controlClock();
  });

  /** El 429 de NGINX, con o sin `Retry-After`. */
  function rateLimited(seconds?: number) {
    return http.post(`*${MICROSOFT_LOGIN_ENDPOINT}`, () =>
      HttpResponse.json(
        { status: 429, error: 'Too Many Requests', message: 'Demasiados intentos' },
        { status: 429, headers: seconds === undefined ? {} : { 'Retry-After': String(seconds) } },
      ),
    );
  }

  /** El bouncer de CrowdSec responde 403 con su página, sin `Retry-After`. */
  function bouncerBlock() {
    return http.post(
      `*${MICROSOFT_LOGIN_ENDPOINT}`,
      () =>
        new HttpResponse('<html><body>Blocked</body></html>', {
          status: 403,
          headers: { 'Content-Type': 'text/html' },
        }),
    );
  }

  async function requestLockout(path = '/login') {
    const view = await renderRoute(path);
    await view.user.click(microsoftButton());
    return { alert: await screen.findByRole('alert'), view };
  }

  function advance(ms: number) {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  }

  it('avisa sin revelar la cuenta, deshabilita el botón y cuenta atrás', async () => {
    server.use(rateLimited(45));
    const navigation = spyPageNavigation();
    const { alert, view } = await requestLockout();

    expect(alert).toHaveTextContent(LOCKOUT_TEXT);
    expect(alert).not.toHaveTextContent(/cuenta/i);
    expect(alert).toHaveTextContent('Podrás intentarlo de nuevo hoy a las 9:20.');
    expect(screen.getByText(/en 0:45/)).toBeInTheDocument();
    expect(microsoftButton()).toBeDisabled();

    await view.user.click(microsoftButton());
    advance(1_000);
    expect(screen.getByText(/en 0:44/)).toBeInTheDocument();

    advance(44_000);
    expect(microsoftButton()).toBeEnabled();
    expect(navigation.assign).not.toHaveBeenCalled();
    // El aviso sale con su animación en el siguiente cuadro.
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it.each([
    ['sin Retry-After', rateLimited()],
    ['el 403 del bouncer de CrowdSec', bouncerBlock()],
  ])('con %s espera un minuto, por prudencia', async (_case, handler) => {
    server.use(handler);
    const { alert } = await requestLockout();

    expect(alert).toHaveTextContent(LOCKOUT_TEXT);
    expect(screen.getByText(/en 1:00/)).toBeInTheDocument();
    expect(microsoftButton()).toBeDisabled();
  });

  it('Retry-After: 0 espera al menos un segundo para no reintentar en bucle', async () => {
    server.use(rateLimited(0));
    await requestLockout();

    expect(screen.getByText(/en 0:01/)).toBeInTheDocument();
    advance(1_000);
    expect(microsoftButton()).toBeEnabled();
  });

  it('muestra las esperas largas en días y horas', async () => {
    server.use(rateLimited(3_600_000));
    await requestLockout();

    expect(screen.getByText(/en 41 d 16 h/)).toBeInTheDocument();
  });

  it('el aviso reemplaza el error con el que se volvió de Microsoft', async () => {
    server.use(rateLimited(30));
    await requestLockout('/login?error=cuenta_no_registrada');

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByText(/no tiene acceso a ZEAL/)).not.toBeInTheDocument();
  });

  it('al vencer el bloqueo deja ir de nuevo a Microsoft', async () => {
    server.use(rateLimited(5));
    const navigation = spyPageNavigation();
    const { view } = await requestLockout();

    advance(5_000);
    server.resetHandlers();
    // `waitFor` sondea con setInterval: para esperar la navegación, el reloj vuelve a ser real.
    vi.useRealTimers();
    await view.user.click(microsoftButton());

    expect(await navigation.target()).toMatch(/^\/simulador\/microsoft\?state=/);
  });

  it('el simulador bloquea tras varios regresos fallidos seguidos', async () => {
    for (let attempt = 0; attempt < LOGIN_MAX_FAILURES; attempt += 1) {
      registerFailedLogin();
    }

    const { alert } = await requestLockout();

    expect(alert).toHaveTextContent(LOCKOUT_TEXT);
    expect(screen.getByText(/en 1:00/)).toBeInTheDocument();
  });
});
