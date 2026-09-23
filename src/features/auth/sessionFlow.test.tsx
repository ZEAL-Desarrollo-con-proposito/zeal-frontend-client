import { act, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ROLE_HOME_PATH } from '@/app/paths';
import { server } from '@/mocks/server';
import { request } from '@/shared/api/httpClient';
import { DEMO_PASSWORD, seedUser, storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import { SESSION_STORAGE_KEY } from './storage/sessionStore';

const EXPIRED_NOTICE = 'Tu sesión expiró por seguridad. Vuelve a iniciar sesión para continuar.';

async function loginAs(
  user: ReturnType<typeof renderRoute>['user'],
  email: string,
  { remember = false } = {},
) {
  await user.type(screen.getByLabelText('Correo corporativo'), email);
  await user.type(screen.getByLabelText('Contraseña'), DEMO_PASSWORD);
  if (remember) {
    await user.click(screen.getByRole('checkbox', { name: 'Recordarme' }));
  }
  await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
}

describe('manejo de la sesión y rutas protegidas', () => {
  it('guarda la sesión solo en la pestaña si no se marca "Recordarme"', async () => {
    const { user } = renderRoute('/login');

    await loginAs(user, seedUser('EMPLEADO').email);

    expect(await screen.findByRole('heading', { name: 'Hola, David' })).toBeInTheDocument();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('recuerda la sesión entre visitas si se marca "Recordarme"', async () => {
    const { user } = renderRoute('/login');

    await loginAs(user, seedUser('ADMIN').email, { remember: true });

    expect(await screen.findByRole('heading', { name: 'Hola, Talento' })).toBeInTheDocument();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();
  });

  it('restaura la sesión guardada y no vuelve a pedir el login', () => {
    storeSession('PSICOLOGO', { remember: true });

    const { router } = renderRoute('/login');

    expect(router.state.location.pathname).toBe(ROLE_HOME_PATH.PSICOLOGO);
    expect(screen.getByRole('heading', { name: 'Hola, Laura' })).toBeInTheDocument();
  });

  it('manda al login a quien abre una ruta protegida sin sesión', async () => {
    const { router, user } = renderRoute(ROLE_HOME_PATH.ADMIN);

    expect(router.state.location.pathname).toBe('/login');

    // Quien pidió la ruta de admin pero es empleado llega a su propia pantalla, no a un 403.
    await loginAs(user, seedUser('EMPLEADO').email);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(ROLE_HOME_PATH.EMPLEADO);
    });
  });

  it('niega el acceso a las rutas de otro rol y ofrece volver al inicio propio', async () => {
    storeSession('EMPLEADO');
    const { router, user } = renderRoute(ROLE_HOME_PATH.ADMIN);

    expect(
      screen.getByRole('heading', { name: 'Esta sección no está disponible para tu rol' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Ir a mi inicio' }));
    expect(router.state.location.pathname).toBe(ROLE_HOME_PATH.EMPLEADO);
  });

  it('cierra la sesión a petición del usuario sin mostrar el aviso de vencimiento', async () => {
    storeSession('EMPLEADO', { remember: true });
    const { router, user } = renderRoute(ROLE_HOME_PATH.EMPLEADO);

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(router.state.location.pathname).toBe('/login');
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(screen.queryByText(EXPIRED_NOTICE)).not.toBeInTheDocument();
  });

  it('cierra la sesión cuando vence el token y lo avisa en el login', async () => {
    storeSession('PSICOLOGO', { expiresInMs: 50 });
    const { router } = renderRoute(ROLE_HOME_PATH.PSICOLOGO);

    expect(await screen.findByText(EXPIRED_NOTICE)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('envía el token y cierra la sesión si el servidor lo rechaza con 401', async () => {
    const session = storeSession('EMPLEADO');
    let receivedAuthorization: string | null = null;
    server.use(
      http.get('*/api/protegido', ({ request: incoming }) => {
        receivedAuthorization = incoming.headers.get('Authorization');
        return HttpResponse.json({ message: 'Token revocado' }, { status: 401 });
      }),
    );
    renderRoute(ROLE_HOME_PATH.EMPLEADO);

    await act(async () => {
      await request('/api/protegido').catch(() => undefined);
    });

    expect(receivedAuthorization).toBe(`Bearer ${session.accessToken}`);
    expect(screen.getByText(EXPIRED_NOTICE)).toBeInTheDocument();
  });

  it('se sincroniza cuando otra pestaña cierra la sesión recordada', async () => {
    storeSession('ADMIN', { remember: true });
    const { router } = renderRoute(ROLE_HOME_PATH.ADMIN);

    act(() => {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      window.dispatchEvent(new StorageEvent('storage', { key: SESSION_STORAGE_KEY }));
      window.dispatchEvent(new StorageEvent('storage', { key: 'otra-clave' }));
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
  });
});
