import { sendTelemetry } from '@/shared/telemetry/telemetryApi';

/** Cada cuánto se envía lo medido, si llegó algún evento. */
export const LATENCY_REPORT_EVERY_MS = 30_000;

/** Máximo de mediciones por envío (el backend rechaza más de 20 eventos). */
export const LATENCY_MAX_EVENTS = 20;

/** Nombres de latencia del contrato `POST /api/telemetria`. */
export type LatencyName = 'notificacion_recibida' | 'mensaje_recibido';

/** Un evento de latencia del contrato de telemetría. */
export interface LatencyEvent {
  type: 'latencia';
  name: LatencyName;
  valueMs: number;
}

/** Cuerpo que acepta el backend: de 1 a 20 eventos. */
export interface LatencyReport {
  events: LatencyEvent[];
}

/** Máximo que acepta el backend para `valueMs`. */
const MAX_VALUE_MS = 120_000;

const CHATS_DESTINATION = '/user/queue/chats';
const PRESENCE_PREFIX = '/topic/presencia/';

/**
 * Qué se mide de cada destino: lo que llega al chat es `mensaje_recibido` y los avisos en vivo
 * (notificaciones, convocatorias, talleres, cupos, franjas) son `notificacion_recibida`. La presencia
 * y los avisos de "escribiendo…" son ruido frecuente que no es un aviso para la persona: no se miden.
 */
export function latencyName(destination: string, payload: object): LatencyName | null {
  if (destination.startsWith(PRESENCE_PREFIX)) {
    return null;
  }
  if (destination === CHATS_DESTINATION) {
    return 'typing' in payload ? null : 'mensaje_recibido';
  }
  return 'notificacion_recibida';
}

/** Hora en que el servidor emitió el evento (`emittedAt`); `null` si no la trae o no es válida. */
function readEmission(payload: unknown): number | null {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('emittedAt' in payload) ||
    typeof payload.emittedAt !== 'string'
  ) {
    return null;
  }
  const at = Date.parse(payload.emittedAt);
  return Number.isNaN(at) ? null : at;
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
 * evento hasta que la pantalla lo pinta. Cada medición es un evento `latencia` del contrato de
 * telemetría; se envían juntas (hasta 20) cada `LATENCY_REPORT_EVERY_MS`. Si en una ventana se miden
 * más de 20, el resto se descarta: es una muestra, no un conteo.
 */
export function createLiveLatency({ now, afterPaint, isVisible, send }: LiveLatencyDependencies) {
  const events: LatencyEvent[] = [];
  /** Eventos esperando el pintado: si dos pantallas escuchan el mismo destino, se mide una vez. */
  const measuring = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  function report(keepalive: boolean) {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (events.length > 0) {
      const report: LatencyReport = { events: events.splice(0) };
      // Una medición perdida no afecta a la persona: el error se descarta.
      send(report, { keepalive }).catch(() => undefined);
    }
  }

  function record(name: LatencyName, ms: number) {
    if (events.length < LATENCY_MAX_EVENTS) {
      events.push({ type: 'latencia', name, valueMs: Math.round(ms) });
    }
    timer ??= setTimeout(() => {
      report(false);
    }, LATENCY_REPORT_EVERY_MS);
  }

  return {
    /** Un evento llegó a una pantalla: se mide hasta que se pinta. */
    observe(destination: string, payload: unknown): void {
      const emittedAt = readEmission(payload);
      // Una pestaña oculta no pinta: su espera no es la de la interfaz.
      if (emittedAt === null || typeof payload !== 'object' || payload === null || !isVisible()) {
        return;
      }
      const name = latencyName(destination, payload);
      if (name === null) {
        return;
      }
      const key = `${destination}@${String(emittedAt)}`;
      if (measuring.has(key)) {
        return;
      }
      measuring.add(key);
      afterPaint(() => {
        measuring.delete(key);
        const ms = now() - emittedAt;
        // Negativa: el reloj del equipo va detrás del servidor; fuera de rango: el backend la rechazaría.
        if (ms >= 0 && ms <= MAX_VALUE_MS) {
          record(name, ms);
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
