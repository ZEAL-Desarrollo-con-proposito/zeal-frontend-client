import { NetworkError, ApiError } from '@/shared/api/errors';
import { newRequestId } from '@/shared/api/requestId';
import { sendTelemetry } from './telemetryApi';
import { telemetryRoute } from './telemetryRoute';

/** Nombres de error reconocidos por el contrato `POST /api/telemetria`. */
export type ErrorTelemetryName =
  'error_js' | 'error_api' | 'chunk_load' | 'ws_desconectado' | 'video_fallo';

export interface ErrorTelemetryReport {
  events: {
    type: 'error';
    name: ErrorTelemetryName;
    route?: string;
  }[];
}

interface ReportOptions {
  /** Fuerza el nombre cuando el contexto lo conoce (p. ej. una desconexión de STOMP). */
  name?: ErrorTelemetryName;
  requestId?: string;
}

interface ErrorTelemetryDependencies {
  send: (
    report: ErrorTelemetryReport,
    options: { keepalive: boolean; requestId: string },
  ) => Promise<void>;
  route: () => string | null | undefined;
  id: () => string;
}

/** La cancelación la pidió quien llama; no es un fallo que deba reportarse. */
function isAbort(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  );
}

/** Un paquete que ya no existe en el servidor (HU-FE-24) no es un error de la aplicación. */
function isChunkLoad(error: unknown): boolean {
  if (error instanceof Error) {
    return /chunkloaderror|dynamically imported module|importing a module script failed|loading chunk/i.test(
      `${error.name}: ${error.message}`,
    );
  }
  if (typeof error === 'string') {
    return /chunkloaderror|dynamically imported module|importing a module script failed|loading chunk/i.test(
      error,
    );
  }
  return false;
}

function requestIdOf(error: unknown): string | undefined {
  return error instanceof ApiError || error instanceof NetworkError ? error.requestId : undefined;
}

function classify(error: unknown): ErrorTelemetryName {
  if (isChunkLoad(error)) {
    return 'chunk_load';
  }
  return error instanceof ApiError || error instanceof NetworkError ? 'error_api' : 'error_js';
}

/**
 * Reporta errores del navegador sin datos personales: solo el tipo, el nombre del contrato y una
 * ruta saneada. Si el fallo fue de una petición, reutiliza su `X-Request-Id` para poder cruzar el
 * reporte con los logs del backend.
 */
export function createErrorTelemetry({ send, route, id }: ErrorTelemetryDependencies) {
  const reported = new WeakSet<object>();

  return {
    report(error: unknown, { name, requestId }: ReportOptions = {}): void {
      if (isAbort(error)) {
        return;
      }
      if (typeof error === 'object' && error !== null) {
        if (reported.has(error)) {
          return;
        }
        reported.add(error);
      }

      const telemetryName = name ?? classify(error);
      const safeRoute = route();
      const event: ErrorTelemetryReport['events'][number] = {
        type: 'error',
        name: telemetryName,
        ...(safeRoute === undefined || safeRoute === null ? {} : { route: safeRoute }),
      };
      const correlationId = requestId ?? requestIdOf(error) ?? id();
      // Un error de telemetría no se reporta: sería un bucle.
      send({ events: [event] }, { keepalive: true, requestId: correlationId }).catch(
        () => undefined,
      );
    },
  };
}

const errorTelemetry = createErrorTelemetry({
  send: (report, options) => sendTelemetry(report, options),
  route: () => telemetryRoute(window.location.pathname),
  id: newRequestId,
});

export function reportError(error: unknown, options?: ReportOptions): void {
  errorTelemetry.report(error, options);
}

export type ErrorReporter = (error: unknown, options?: ReportOptions) => void;

/**
 * Escucha los errores que no atrapa una pantalla: `window.error`, promesas rechazadas y paquetes
 * que ya no existen tras un despliegue. Devuelve la función para dejar de escuchar.
 */
export function installErrorTelemetry(page: EventTarget, report: ErrorReporter = reportError) {
  const onError = (event: Event) => {
    const errorEvent = event as ErrorEvent;
    report(errorEvent.error ?? errorEvent.message);
  };
  const onRejection = (event: Event) => {
    report((event as PromiseRejectionEvent).reason);
  };
  const onPreload = (event: Event) => {
    report(event, { name: 'chunk_load' });
  };

  page.addEventListener('error', onError);
  page.addEventListener('unhandledrejection', onRejection);
  page.addEventListener('vite:preloadError', onPreload);

  return () => {
    page.removeEventListener('error', onError);
    page.removeEventListener('unhandledrejection', onRejection);
    page.removeEventListener('vite:preloadError', onPreload);
  };
}
