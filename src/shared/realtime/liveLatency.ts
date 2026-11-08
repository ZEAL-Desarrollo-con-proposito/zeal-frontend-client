import { sendTelemetry } from '@/shared/telemetry/telemetryApi';
import type { LatencyReport } from './latencyHistogram';
import { createLatencyHistogram } from './latencyHistogram';

/** Cada cuánto se envía lo medido, si llegó algún evento. */
export const LATENCY_REPORT_EVERY_MS = 30_000;

/** Prefijos de los destinos de STOMP: no dicen nada del evento. */
const DESTINATION_PREFIX = /^\/(?:topic|user\/queue)\//;
/** Tipos de evento del contrato (`PUBLICADO`, `CUPOS`…); cualquier otra cosa se agrupa como `OTRO`. */
const EVENT_TYPE = /^[A-Z][A-Z_]{0,39}$/;

/**
 * Nombre del evento en la métrica, sin identificadores ni datos personales. Los destinos siguen la
 * convención recurso/{id}/subrecurso: se conservan los recursos y se descartan los ids
 * (`/topic/organizaciones/{empresa}/talleres` → `organizaciones/talleres`), y se agrega el tipo.
 */
export function latencyEventName(destination: string, type: string): string {
  const resources = destination
    .replace(DESTINATION_PREFIX, '')
    .split('/')
    .filter((_segment, index) => index % 2 === 0);
  return `${resources.join('/')}:${type}`;
}

/** Hora en que el servidor emitió el evento (`emittedAt`) y su tipo; `null` si no la trae. */
function readEmission(payload: unknown): { at: number; type: string } | null {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('emittedAt' in payload) ||
    typeof payload.emittedAt !== 'string'
  ) {
    return null;
  }
  const at = Date.parse(payload.emittedAt);
  if (Number.isNaN(at)) {
    return null;
  }
  const type =
    'type' in payload && typeof payload.type === 'string' && EVENT_TYPE.test(payload.type)
      ? payload.type
      : 'OTRO';
  return { at, type };
}

interface LiveLatencyDependencies {
  now: () => number;
  /** Llama a `done` cuando el navegador ya pintó lo que cambió el evento. */
  afterPaint: (done: () => void) => void;
  isVisible: () => boolean;
  send: (report: LatencyReport, options: { keepalive: boolean }) => Promise<void>;
}

/**
 * Latencia de los avisos en vivo (HU-FE-24, escenario REND-1): desde que el servidor emite un
 * evento hasta que la pantalla lo pinta. Se agrega en un histograma por tipo de evento y se envía
 * cada `LATENCY_REPORT_EVERY_MS`.
 */
export function createLiveLatency({ now, afterPaint, isVisible, send }: LiveLatencyDependencies) {
  const histogram = createLatencyHistogram();
  /** Eventos esperando el pintado: si dos pantallas escuchan el mismo destino, se mide una vez. */
  const measuring = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  function report(keepalive: boolean) {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    const drained = histogram.drain();
    if (drained !== null) {
      // Una medición perdida no afecta a la persona: el error se descarta.
      send(drained, { keepalive }).catch(() => undefined);
    }
  }

  function record(event: string, ms: number) {
    histogram.record(event, ms);
    timer ??= setTimeout(() => {
      report(false);
    }, LATENCY_REPORT_EVERY_MS);
  }

  return {
    /** Un evento llegó a una pantalla: se mide hasta que se pinta. */
    observe(destination: string, payload: unknown): void {
      const emission = readEmission(payload);
      // Una pestaña oculta no pinta: su espera no es la de la interfaz.
      if (emission === null || !isVisible()) {
        return;
      }
      const event = latencyEventName(destination, emission.type);
      const key = `${event}@${String(emission.at)}`;
      if (measuring.has(key)) {
        return;
      }
      measuring.add(key);
      afterPaint(() => {
        measuring.delete(key);
        const ms = now() - emission.at;
        // Negativa: el reloj del equipo va detrás del servidor y la medición no sirve.
        if (ms >= 0) {
          record(event, ms);
        }
      });
    },

    /** Envía ya lo medido: la pestaña se oculta o se cierra y quizá no vuelva. */
    flush(): void {
      report(true);
    },
  };
}

/**
 * Medición de la sesión. `requestAnimationFrame` corre justo antes de pintar el siguiente cuadro y
 * el `setTimeout` dentro de él, justo después: para entonces el evento ya se ve en pantalla.
 */
export const liveLatency = createLiveLatency({
  now: () => Date.now(),
  afterPaint: (done) => {
    requestAnimationFrame(() => {
      setTimeout(done, 0);
    });
  },
  isVisible: () => document.visibilityState === 'visible',
  send: (report, { keepalive }) => sendTelemetry(report, { keepalive }),
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    liveLatency.flush();
  }
});
