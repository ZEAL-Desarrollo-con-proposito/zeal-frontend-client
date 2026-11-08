import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { PSYCHOLOGISTS_ENDPOINT } from '@/features/directory/api/directoryApi';
import type { Role } from '@/features/auth/model/session';
import { sessionStore } from '@/features/auth/storage/sessionStore';
import { server } from '@/mocks/server';
import { buildSession, storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import { EMPLOYEE_PATHS, PSYCHOLOGIST_PATHS, ROLE_HOME_PATH, sessionRoomPath } from './paths';

const DENIED_TITLE = 'Esta sección no está disponible para tu rol';
const NOT_FOUND_TITLE = 'No encontramos esta página';

/** Sesión alterada en el navegador: dice ser de `role`, pero el token es del administrador. */
function storeTamperedSession(role: Role) {
  sessionStore.save({ ...buildSession(role), accessToken: buildSession('ADMIN').accessToken });
}

/** Rutas del API que se pidieron durante la prueba. */
function recordRequests() {
  const paths: string[] = [];
  server.events.on('request:start', ({ request }) => {
    paths.push(new URL(request.url).pathname);
  });
  return paths;
}

async function deniedHeading() {
  return screen.findByRole('heading', { name: DENIED_TITLE });
}

/** El foco pasa al título en un efecto: puede llegar un instante después de que aparece. */
async function expectDeniedWithFocus() {
  const heading = await deniedHeading();
  await waitFor(() => {
    expect(heading).toHaveFocus();
  });
}

describe('Acceso denegado al módulo de bienestar (HU-FE-11)', () => {
  afterEach(() => {
    server.events.removeAllListeners();
  });

  it('el menú del administrador no ofrece bienestar, citas ni mensajes', async () => {
    storeSession('ADMIN');
    await renderRoute(ROLE_HOME_PATH.ADMIN);

    const sidebar = within(screen.getByRole('complementary', { name: 'Barra lateral' }));
    for (const label of ['Bienestar', 'Mis citas', 'Mensajes', 'Mi agenda', 'Disponibilidad']) {
      expect(sidebar.queryByRole('link', { name: label })).not.toBeInTheDocument();
    }
  });

  it.each([
    ['el chat de un empleado', '/empleado/mensajes'],
    ['una conversación enlazada directamente', '/empleado/mensajes/conversacion-1'],
    ['el directorio de psicólogos', EMPLOYEE_PATHS.wellbeing],
    ['la sala de una sesión', sessionRoomPath('reserva-1')],
  ])(
    'el administrador que abre %s ve "Permiso denegado" sin pedir nada al servidor',
    async (_case, path) => {
      const requests = recordRequests();
      storeSession('ADMIN');
      const { router, user } = await renderRoute(path);

      await expectDeniedWithFocus();
      expect(
        screen.queryByRole('complementary', { name: 'Barra lateral' }),
      ).not.toBeInTheDocument();
      expect(requests.filter((request) => request.startsWith('/api/wellbeing'))).toEqual([]);

      await user.click(screen.getByRole('link', { name: 'Ir a mi inicio' }));
      expect(router.state.location.pathname).toBe(ROLE_HOME_PATH.ADMIN);
    },
  );

  it('si el servidor oculta el recurso con 404 (SEG-3), reemplaza la pantalla sin confirmar que existe', async () => {
    storeTamperedSession('EMPLEADO');
    const { router, user } = await renderRoute(EMPLOYEE_PATHS.wellbeing);

    const heading = await screen.findByRole('heading', { name: NOT_FOUND_TITLE });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
    expect(screen.queryByText(/Laura Martínez/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: DENIED_TITLE })).not.toBeInTheDocument();

    // Al salir, la aplicación vuelve a su estructura normal.
    await user.click(screen.getByRole('link', { name: 'Volver al inicio' }));
    expect(router.state.location.pathname).toBe(ROLE_HOME_PATH.EMPLEADO);
    expect(await screen.findByRole('complementary', { name: 'Barra lateral' })).toBeInTheDocument();
  });

  it('también cuando el 404 llega al cargar la semana de franjas', async () => {
    storeTamperedSession('PSICOLOGO');
    await renderRoute(PSYCHOLOGIST_PATHS.availability);

    expect(await screen.findByRole('heading', { name: NOT_FOUND_TITLE })).toBeInTheDocument();
  });

  it('si el servidor todavía responde 403, muestra "Permiso denegado" sin nada del contenido', async () => {
    server.use(
      http.get(`*${PSYCHOLOGISTS_ENDPOINT}`, () => new HttpResponse(null, { status: 403 })),
    );
    storeSession('EMPLEADO');
    await renderRoute(EMPLOYEE_PATHS.wellbeing);

    await expectDeniedWithFocus();
    expect(screen.queryByText(/Laura Martínez/)).not.toBeInTheDocument();
  });

  it('una dirección inexistente dentro del propio rol sigue siendo "no encontrada"', async () => {
    storeSession('EMPLEADO');
    await renderRoute('/empleado/seccion-que-no-existe');

    expect(screen.getByRole('heading', { name: 'No encontramos esta página' })).toHaveFocus();
  });

  it('sin sesión, un enlace a una conversación manda primero al login', async () => {
    const { router } = await renderRoute('/empleado/mensajes/conversacion-1');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
  });
});
