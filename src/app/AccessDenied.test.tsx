import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { server } from '@/mocks/server';
import { storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import { EMPLOYEE_PATHS, ROLE_HOME_PATH, sessionRoomPath } from './paths';

const DENIED_TITLE = 'Esta sección no está disponible para tu rol';

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

describe('Acceso denegado al módulo de bienestar (HU-FE-11)', () => {
  afterEach(() => {
    server.events.removeAllListeners();
  });

  it('el menú del administrador no ofrece bienestar, citas ni mensajes', () => {
    storeSession('ADMIN');
    renderRoute(ROLE_HOME_PATH.ADMIN);

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
      const { router, user } = renderRoute(path);

      expect(await deniedHeading()).toBeInTheDocument();
      expect(
        screen.queryByRole('complementary', { name: 'Barra lateral' }),
      ).not.toBeInTheDocument();
      expect(requests.filter((request) => request.startsWith('/api/wellbeing'))).toEqual([]);

      await user.click(screen.getByRole('link', { name: 'Ir a mi inicio' }));
      expect(router.state.location.pathname).toBe(ROLE_HOME_PATH.ADMIN);
    },
  );

  it('una dirección inexistente dentro del propio rol sigue siendo "no encontrada"', () => {
    storeSession('EMPLEADO');
    renderRoute('/empleado/seccion-que-no-existe');

    expect(screen.getByRole('heading', { name: 'No encontramos esta página' })).toBeInTheDocument();
  });

  it('sin sesión, un enlace a una conversación manda primero al login', () => {
    const { router } = renderRoute('/empleado/mensajes/conversacion-1');

    expect(router.state.location.pathname).toBe('/login');
  });
});
