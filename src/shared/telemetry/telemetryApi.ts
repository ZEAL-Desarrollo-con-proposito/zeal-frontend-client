import { request } from '@/shared/api/httpClient';

/** Endpoint donde el navegador reporta sus mediciones (HU-FE-24 y HU-FE-25, contraparte HU-BE-25). */
export const TELEMETRY_ENDPOINT = '/api/telemetria';

/**
 * Envía un reporte de telemetría, que nunca lleva datos personales. Con `keepalive` la petición
 * termina aunque la pestaña se esté cerrando. Si falla no se reintenta: una medición perdida no
 * justifica más tráfico, y quien llama decide si la descarta.
 */
export async function sendTelemetry(
  report: object,
  { keepalive = false }: { keepalive?: boolean } = {},
): Promise<void> {
  await request(TELEMETRY_ENDPOINT, { method: 'POST', body: report, keepalive });
}
