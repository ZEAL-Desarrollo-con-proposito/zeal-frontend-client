import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { EMPLOYEE_PATHS } from '@/app/paths';
import { SEED_ORGANIZATION } from '@/mocks/seedUsers';
import { server } from '@/mocks/server';
import type { LatencyReport } from '@/shared/realtime/latencyHistogram';
import { TELEMETRY_ENDPOINT } from '@/shared/telemetry/telemetryApi';
import { freezeTime } from '@/test/clock';
import { storeSession } from '@/test/credentials';
import { scriptedRealtimeClient } from '@/test/realtime';
import { renderRoute } from '@/test/renderRoute';
import { organizationWorkshopsTopic } from './model/workshopEvent';

/** Espera a que el navegador pinte el siguiente cuadro. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 0);
    });
  });
}

/** La persona cambia de pestaña (`hidden`) o vuelve a ella (`visible`). */
function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('Latencia de un taller publicado en vivo (HU-FE-24, REND-1)', () => {
  afterEach(() => {
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('mide cuánto tarda en pintarse y lo reporta al backend al ocultar la pestaña', async () => {
    freezeTime();
    const reports: { body: LatencyReport; keepalive: boolean }[] = [];
    server.use(
      http.post(`*${TELEMETRY_ENDPOINT}`, async ({ request }) => {
        reports.push({
          body: (await request.json()) as LatencyReport,
          keepalive: request.keepalive,
        });
        return new HttpResponse(null, { status: 204 });
      }),
    );
    storeSession('EMPLEADO');
    const realtime = scriptedRealtimeClient();
    const { subscribedTo } = await renderRoute(EMPLOYEE_PATHS.workshops, () => realtime.client);
    const topic = organizationWorkshopsTopic(SEED_ORGANIZATION);
    await subscribedTo(topic);

    // El servidor lo emitió hace 180 ms (el reloj de la prueba está quieto).
    act(() => {
      realtime.deliver(topic, {
        type: 'PUBLICADO',
        emittedAt: new Date(Date.now() - 180).toISOString(),
        workshop: {
          id: 'taller-en-vivo',
          title: 'Taller recién publicado',
          description: 'Técnicas breves para bajar el ritmo entre reuniones.',
          capacity: 10,
          occupied: 0,
          version: 1,
          startsAt: new Date(2026, 8, 25, 9).toISOString(),
          durationMinutes: 60,
          publishedAt: new Date().toISOString(),
        },
      });
    });
    expect(
      within(await screen.findByRole('listitem', { name: 'Taller recién publicado' })).getByText(
        '0 / 10 cupos',
      ),
    ).toBeInTheDocument();
    await nextPaint();

    setVisibility('visible'); // Volver a la pestaña no envía nada.
    setVisibility('hidden');

    await waitFor(() => {
      expect(reports).toHaveLength(1);
    });
    expect(reports[0]).toEqual({
      keepalive: true,
      body: {
        type: 'LATENCIA_EN_VIVO',
        series: [
          expect.objectContaining({
            event: 'organizaciones/talleres:PUBLICADO',
            count: 1,
            sumMs: 180,
            le: expect.objectContaining({ '100': 0, '250': 1, '500': 1 }) as Record<string, number>,
          }),
        ],
      },
    });
  });
});
