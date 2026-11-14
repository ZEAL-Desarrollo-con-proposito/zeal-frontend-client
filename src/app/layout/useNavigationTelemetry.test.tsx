import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { server } from '@/mocks/server';
import { storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import { registerAppTelemetryRoutes } from '../telemetryRoutes';

interface Reported {
  type: string;
  route?: string;
}

/** Eventos de navegación que el navegador envía a la telemetría desde que se llama a esta función. */
function captureNavigation(): Reported[] {
  const events: Reported[] = [];
  // En `request:start` el cuerpo aún no lo consumió el servidor simulado.
  server.events.on('request:start', ({ request }) => {
    if (request.url.endsWith('/api/telemetria')) {
      void request
        .clone()
        .json()
        .then((report: { events: Reported[] }) => {
          events.push(
            ...report.events.filter(({ type }) => type === 'vista' || type === 'interaccion'),
          );
        });
    }
  });
  return events;
}

describe('Telemetría de navegación (HU-FE-25)', () => {
  beforeEach(() => {
    registerAppTelemetryRoutes();
  });

  it('reporta cada sección que visita, sin identificadores', async () => {
    storeSession('EMPLEADO');
    const reported = captureNavigation();
    const { user } = await renderRoute('/empleado/inicio');

    await user.click(
      within(screen.getByRole('complementary', { name: 'Barra lateral' })).getByRole('link', {
        name: 'Mis citas',
      }),
    );
    await user.click(
      within(screen.getByRole('complementary', { name: 'Barra lateral' })).getByRole('link', {
        name: 'Talleres',
      }),
    );

    await waitFor(() => {
      expect(reported).toContainEqual({ type: 'vista', route: '/empleado/inicio' });
    });
    await waitFor(() => {
      expect(reported).toContainEqual({ type: 'vista', route: '/empleado/mis-citas' });
    });
    expect(reported.every(({ route }) => route?.startsWith('/empleado/'))).toBe(true);
  });
});
