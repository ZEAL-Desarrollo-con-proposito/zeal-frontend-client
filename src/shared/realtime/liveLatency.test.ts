import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LatencyReport } from './latencyHistogram';
import { createLiveLatency, LATENCY_REPORT_EVERY_MS, latencyEventName } from './liveLatency';

const EMITTED = Date.parse('2026-09-23T14:20:00.000Z');
const TOPIC = '/topic/organizaciones/org-nexura/talleres';
const EVENT = 'organizaciones/talleres:PUBLICADO';

type Send = (report: LatencyReport, options: { keepalive: boolean }) => Promise<void>;

/** Medición con reloj, pintado y visibilidad bajo control de la prueba. */
function setup({ visible = true, send = vi.fn<Send>(() => Promise.resolve()) } = {}) {
  let clock = EMITTED;
  const pending: (() => void)[] = [];
  const latency = createLiveLatency({
    now: () => clock,
    afterPaint: (done) => {
      pending.push(done);
    },
    isVisible: () => visible,
    send,
  });
  return {
    latency,
    send,
    /** El navegador pinta lo pendiente `ms` después de `EMITTED`. */
    paintAt: (ms: number) => {
      clock = EMITTED + ms;
      pending.splice(0).forEach((done) => {
        done();
      });
    },
  };
}

/** Evento publicado `ms` después de `EMITTED`. */
function published(ms = 0, type: unknown = 'PUBLICADO') {
  return { type, emittedAt: new Date(EMITTED + ms).toISOString(), workshop: { id: 'taller-1' } };
}

function sentSeries(send: ReturnType<typeof setup>['send']) {
  return send.mock.calls.flatMap(([report]) => report.series);
}

describe('latencia de los avisos en vivo (HU-FE-24, REND-1)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mide desde la emisión hasta el pintado y lo envía agregado cada 30 s', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { latency, send, paintAt } = setup();

    latency.observe(TOPIC, published());
    paintAt(180);
    latency.observe(TOPIC, published(1000));
    paintAt(1600);
    vi.advanceTimersByTime(LATENCY_REPORT_EVERY_MS - 1);
    expect(send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(send).toHaveBeenCalledExactlyOnceWith(
      {
        type: 'LATENCIA_EN_VIVO',
        series: [
          {
            event: EVENT,
            count: 2,
            sumMs: 780,
            maxMs: 600,
            le: {
              '50': 0,
              '100': 0,
              '250': 1,
              '500': 1,
              '1000': 2,
              '2500': 2,
              '5000': 2,
              '10000': 2,
              '+Inf': 2,
            },
          },
        ],
      },
      { keepalive: false },
    );
    vi.advanceTimersByTime(LATENCY_REPORT_EVERY_MS);
    expect(send).toHaveBeenCalledOnce();
  });

  it.each([
    ['/topic/organizaciones/org-nexura/talleres', 'PUBLICADO', 'organizaciones/talleres:PUBLICADO'],
    ['/topic/talleres/taller-impostor/cupos', 'CUPOS', 'talleres/cupos:CUPOS'],
    ['/topic/presencia/usr-empleado-001', 'PRESENCIA', 'presencia:PRESENCIA'],
    ['/user/queue/notificaciones', 'NUEVA', 'notificaciones:NUEVA'],
    ['/topic/franjas', 'CREADA', 'franjas:CREADA'],
  ])('%s se reporta sin ids como %s → %s', (destination, type, name) => {
    expect(latencyEventName(destination, type)).toBe(name);
  });

  it('un tipo que no es del contrato se agrupa como OTRO', () => {
    const { latency, send, paintAt } = setup();

    latency.observe(TOPIC, published(0, 'tipo inventado'));
    latency.observe(TOPIC, { emittedAt: new Date(EMITTED + 1).toISOString() });
    paintAt(10);
    latency.flush();

    expect(sentSeries(send)).toEqual([
      expect.objectContaining({ event: 'organizaciones/talleres:OTRO', count: 2 }),
    ]);
  });

  it.each([
    ['sin cuerpo de objeto', null],
    ['un texto', 'PUBLICADO'],
    ['sin hora de emisión', { type: 'PUBLICADO' }],
    ['con una hora que no es texto', { type: 'PUBLICADO', emittedAt: 7 }],
    ['con una hora inválida', { type: 'PUBLICADO', emittedAt: 'ayer' }],
  ])('no mide un evento %s', (_case, payload) => {
    const { latency, send, paintAt } = setup();

    latency.observe(TOPIC, payload);
    paintAt(10);
    latency.flush();

    expect(send).not.toHaveBeenCalled();
  });

  it('un evento que escuchan dos pantallas se mide una sola vez', () => {
    const { latency, send, paintAt } = setup();

    latency.observe(TOPIC, published());
    latency.observe(TOPIC, published());
    paintAt(40);
    latency.flush();

    expect(sentSeries(send)).toEqual([expect.objectContaining({ event: EVENT, count: 1 })]);
  });

  it('con la pestaña oculta no mide: no pinta hasta que la persona vuelve', () => {
    const { latency, send, paintAt } = setup({ visible: false });

    latency.observe(TOPIC, published());
    paintAt(90_000);
    latency.flush();

    expect(send).not.toHaveBeenCalled();
  });

  it('descarta la medición si el reloj del equipo va detrás del servidor', () => {
    const { latency, send, paintAt } = setup();

    latency.observe(TOPIC, published(500));
    paintAt(100);
    latency.flush();

    expect(send).not.toHaveBeenCalled();
  });

  it('al ocultarse la pestaña envía de inmediato, con keepalive, y no lo repite', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { latency, send, paintAt } = setup();

    latency.observe(TOPIC, published());
    paintAt(120);
    latency.flush();
    vi.advanceTimersByTime(LATENCY_REPORT_EVERY_MS);

    expect(send).toHaveBeenCalledExactlyOnceWith(expect.any(Object), { keepalive: true });
  });

  it('si el envío falla, descarta esa ventana y sigue midiendo', async () => {
    const send = vi.fn<Send>(() => Promise.reject(new Error('sin conexión')));
    const { latency, paintAt } = setup({ send });

    latency.observe(TOPIC, published());
    paintAt(30);
    latency.flush();
    await Promise.resolve();
    latency.observe(TOPIC, published(100));
    paintAt(150);
    latency.flush();

    expect(sentSeries(send)).toEqual([
      expect.objectContaining({ count: 1, sumMs: 30 }),
      expect.objectContaining({ count: 1, sumMs: 50 }),
    ]);
  });
});
