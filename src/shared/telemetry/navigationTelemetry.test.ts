import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/mocks/server';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { buildSession } from '@/test/credentials';
import type { NavigationReport } from './navigationTelemetry';
import { TELEMETRY_ENDPOINT, TELEMETRY_MAX_EVENTS } from './telemetryApi';
import {
  createNavigationTelemetry,
  MAX_INTERACTION_MS,
  MIN_INTERACTION_MS,
  stopTrackingViews,
  trackView,
} from './navigationTelemetry';

type Send = (report: NavigationReport) => Promise<void>;

/** Eventos del contrato de `POST /api/telemetria`. */
const vista = (route: string) => ({ type: 'uso', name: 'vista', route });
const interaccion = (route: string, valueMs: number) => ({
  type: 'latencia',
  name: 'interaccion',
  route,
  valueMs,
});

function setup({ visible = true }: { visible?: boolean } = {}) {
  const clock = { now: 1_000_000 };
  const send = vi.fn<Send>(() => Promise.resolve());
  const navigation = createNavigationTelemetry({
    send,
    now: () => clock.now,
    isVisible: () => visible,
  });
  return { clock, send, navigation };
}

describe('navigationTelemetry', () => {
  it('envía la vista de la pantalla y su tiempo de interacción al dejarla', () => {
    const { clock, send, navigation } = setup();

    navigation.enter('/empleado/mis-citas');
    expect(send).not.toHaveBeenCalled();
    clock.now += 42_400;
    navigation.leave();

    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith({
      events: [vista('/empleado/mis-citas'), interaccion('/empleado/mis-citas', 42_400)],
    });
  });

  it('al navegar de una pantalla a otra, un solo envío trae el cierre de la primera', () => {
    const { clock, send, navigation } = setup();

    navigation.enter('/empleado/inicio');
    clock.now += 5_000;
    navigation.leave();
    navigation.enter('/empleado/talleres');
    clock.now += 7_000;
    navigation.leave();

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]?.[0]).toEqual({
      events: [vista('/empleado/talleres'), interaccion('/empleado/talleres', 7_000)],
    });
  });

  it('un paso por la pantalla de menos de un segundo cuenta como vista, no como interacción', () => {
    const { clock, send, navigation } = setup();

    navigation.enter('/empleado/inicio');
    clock.now += MIN_INTERACTION_MS - 1;
    navigation.leave();

    expect(send).toHaveBeenCalledWith({ events: [vista('/empleado/inicio')] });
  });

  it('una pestaña olvidada abierta no pasa del tope de interacción', () => {
    const { clock, send, navigation } = setup();

    navigation.enter('/empleado/inicio');
    clock.now += 3 * 60 * 60 * 1000;
    navigation.leave();

    expect(send.mock.calls[0]?.[0].events[1]).toEqual(
      interaccion('/empleado/inicio', MAX_INTERACTION_MS),
    );
  });

  it('solo cuenta el tiempo con la pestaña visible', () => {
    const { clock, send, navigation } = setup();

    navigation.enter('/empleado/inicio');
    clock.now += 10_000;
    navigation.hide();
    clock.now += 60_000; // pestaña oculta: no cuenta
    navigation.show();
    clock.now += 5_000;
    navigation.leave();

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]?.[0]).toEqual({
      events: [vista('/empleado/inicio'), interaccion('/empleado/inicio', 10_000)],
    });
    expect(send.mock.calls[1]?.[0]).toEqual({
      events: [interaccion('/empleado/inicio', 5_000)],
    });
  });

  it('si se llega con la pestaña oculta, el tiempo corre desde que se vuelve a ver', () => {
    const { clock, send, navigation } = setup({ visible: false });

    navigation.enter('/empleado/inicio');
    clock.now += 30_000; // oculta: no cuenta
    navigation.show();
    clock.now += 3_000;
    navigation.leave();

    expect(send.mock.calls[0]?.[0].events[1]).toMatchObject({ valueMs: 3_000 });
  });

  it('una ruta que no se reporta no envía nada ni cuenta tiempo', () => {
    const { clock, send, navigation } = setup();

    navigation.enter(undefined);
    clock.now += 20_000;
    navigation.show();
    navigation.hide();
    navigation.leave();

    expect(send).not.toHaveBeenCalled();
  });

  it('ocultar la pestaña sin nada pendiente no envía nada', () => {
    const { send, navigation } = setup();

    navigation.hide();

    expect(send).not.toHaveBeenCalled();
  });

  it('no reintenta un envío fallido', async () => {
    const send = vi.fn<Send>(() => Promise.reject(new Error('sin red')));
    const navigation = createNavigationTelemetry({
      send,
      now: () => 0,
      isVisible: () => true,
    });

    navigation.enter('/empleado/inicio');
    navigation.leave();
    await Promise.resolve();

    expect(send).toHaveBeenCalledOnce();
  });

  it(`quien navega mucho sin ocultar la pestaña envía lotes de máximo ${String(TELEMETRY_MAX_EVENTS)} eventos`, () => {
    const { clock, send, navigation } = setup();

    for (let screen = 0; screen < 11; screen += 1) {
      navigation.enter('/empleado/inicio');
      clock.now += 2_000;
    }
    navigation.leave();

    const reports = send.mock.calls.map(([report]) => report.events);
    expect(reports.every((events) => events.length <= TELEMETRY_MAX_EVENTS)).toBe(true);
    expect(reports.flat()).toHaveLength(22);
    expect(reports.flat().filter(({ type }) => type === 'uso')).toHaveLength(11);
  });
});

describe('navegación de la pestaña', () => {
  afterEach(() => {
    vi.useRealTimers();
    configureHttpAuth(null);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });

  function setVisibility(state: 'hidden' | 'visible') {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  it('ocultar la pestaña envía lo acumulado y volver a verla reanuda el tiempo', async () => {
    const reports: NavigationReport[] = [];
    server.use(
      http.post(`*${TELEMETRY_ENDPOINT}`, async ({ request }) => {
        reports.push((await request.json()) as NavigationReport);
        return new HttpResponse(null, { status: 202 });
      }),
    );
    configureHttpAuth({
      accessToken: buildSession('EMPLEADO').accessToken,
      renew: () => Promise.resolve(null),
    });
    vi.useFakeTimers({ toFake: ['Date'] });

    trackView('/empleado/inicio');
    vi.advanceTimersByTime(4_000);
    setVisibility('hidden');
    await vi.waitFor(() => {
      expect(reports).toHaveLength(1);
    });
    setVisibility('visible');
    vi.advanceTimersByTime(2_000);
    stopTrackingViews();
    await vi.waitFor(() => {
      expect(reports).toHaveLength(2);
    });

    expect(reports[0]?.events).toEqual([
      vista('/empleado/inicio'),
      interaccion('/empleado/inicio', 4_000),
    ]);
    expect(reports[1]?.events).toEqual([interaccion('/empleado/inicio', 2_000)]);
  });

  it('el backend acepta lo que reporta la pestaña (contrato de POST /api/telemetria)', async () => {
    const statuses: number[] = [];
    server.events.on('response:mocked', ({ response }) => {
      statuses.push(response.status);
    });
    configureHttpAuth({
      accessToken: buildSession('EMPLEADO').accessToken,
      renew: () => Promise.resolve(null),
    });
    vi.useFakeTimers({ toFake: ['Date'] });

    trackView('/empleado/inicio');
    vi.advanceTimersByTime(4_000);
    trackView('/empleado/mis-citas');
    vi.advanceTimersByTime(3 * 60 * 60 * 1000);
    stopTrackingViews();
    await vi.waitFor(() => {
      expect(statuses).toHaveLength(1);
    });
    server.events.removeAllListeners();

    expect(statuses).toEqual([202]);
  });
});
