import { sendTelemetry } from '@/shared/telemetry/telemetryApi';

/** Cada cuánto se envía el uso acumulado, si hay algo que reportar. */
export const USAGE_REPORT_EVERY_MS = 30_000;

/** Máximo de eventos por envío (el backend rechaza más de 20). */
export const USAGE_MAX_EVENTS = 20;

/** Nombres de uso del contrato `POST /api/telemetria`. */
export type UsageTelemetryName =
  | 'login'
  | 'reservar_cita'
  | 'cancelar_cita'
  | 'chat_enviado'
  | 'postular'
  | 'inscribir_taller'
  | 'entrar_sala'
  | 'entrar_taller'
  | 'tomar_cupo'
  | 'carga_inicial';

/** Un evento de uso del contrato de telemetría. */
export interface UsageEvent {
  type: 'uso';
  name: UsageTelemetryName;
}

/** Cuerpo que acepta el backend: de 1 a 20 eventos. */
export interface UsageReport {
  events: UsageEvent[];
}

interface UsageTelemetryDependencies {
  send: (report: UsageReport) => Promise<void>;
}

export function createUsageTelemetry({ send }: UsageTelemetryDependencies) {
  const events: UsageEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  function flush(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (events.length === 0) {
      return;
    }
    const report: UsageReport = { events: [...events] };
    // Una medición perdida no justifica más tráfico: no se reintenta el reporte.
    void send(report).catch(() => undefined);
    events.length = 0;
  }

  return {
    track(name: UsageTelemetryName): void {
      events.push({ type: 'uso', name });
      if (events.length >= USAGE_MAX_EVENTS) {
        // El lote está lleno: se envía ya, en vez de descartar el uso que siga llegando.
        flush();
        return;
      }
      timer ??= setTimeout(flush, USAGE_REPORT_EVERY_MS);
    },
    flush,
  };
}

const usageTelemetry = createUsageTelemetry({
  send: (report) => sendTelemetry(report, { keepalive: true }),
});

window.addEventListener('visibilitychange', () => {
  usageTelemetry.flush();
});

export function trackUsage(name: UsageTelemetryName): void {
  usageTelemetry.track(name);
}

export function flushUsage(): void {
  usageTelemetry.flush();
}
