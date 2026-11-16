import { request } from '@/shared/api/httpClient';

/** Endpoint donde el navegador reporta sus mediciones (HU-FE-24 y HU-FE-25, contraparte HU-BE-25). */
export const TELEMETRY_ENDPOINT = '/api/telemetria';

/** Eventos por envío que acepta el backend: un reporte con más se rechaza entero (`400`). */
export const TELEMETRY_MAX_EVENTS = 20;

/** Mayor `valueMs` que acepta el backend en un evento (2 minutos). */
export const TELEMETRY_MAX_VALUE_MS = 120_000;

/**
 * Envía un reporte de telemetría, que nunca lleva datos personales. Con `keepalive` la petición
 * termina aunque la pestaña se esté cerrando. Se usa `fetch` y no `navigator.sendBeacon` porque el
 * endpoint exige sesión: `sendBeacon` no permite la cabecera `Authorization` ni `X-Request-Id`. Si falla no se reintenta: una medición perdida no
 * justifica más tráfico, y quien llama decide si la descarta.
 */
export async function sendTelemetry(
  report: object,
  { keepalive = false, requestId }: { keepalive?: boolean; requestId?: string } = {},
): Promise<void> {
  await request(TELEMETRY_ENDPOINT, {
    method: 'POST',
    body: report,
    keepalive,
    requestId,
  });
}
