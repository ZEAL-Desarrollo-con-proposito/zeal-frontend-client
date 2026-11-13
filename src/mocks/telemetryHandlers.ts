import { http, HttpResponse } from 'msw';
import { TELEMETRY_ENDPOINT } from '@/shared/telemetry/telemetryApi';
import { authenticate, errorBody } from './mockAuth';

/** Eventos por envío que acepta el backend. */
const MAX_EVENTS = 20;

/** Tamaño máximo de un reporte, como el límite que pondrá el backend (tarea 461). */
const MAX_REPORT_BYTES = 16 * 1024;

/**
 * Endpoint de telemetría simulado (HU-BE-25): solo con sesión, `{ events: [1 a 20] }` y límite de tamaño. Acepta el
 * reporte sin guardarlo; en el navegador se ve en la pestaña de red de las herramientas.
 */
export const telemetryHandlers = [
  http.post(`*${TELEMETRY_ENDPOINT}`, async ({ request }) => {
    const user = authenticate(request);
    if (user instanceof Response) {
      return user;
    }
    const body = await request.text();
    if (body.length > MAX_REPORT_BYTES) {
      return errorBody(413, 'Payload Too Large', 'El reporte supera el tamaño permitido.');
    }
    let report: unknown;
    try {
      report = JSON.parse(body);
    } catch {
      return errorBody(400, 'Bad Request', 'El reporte no es JSON.');
    }
    const events =
      typeof report === 'object' && report !== null && 'events' in report ? report.events : null;
    if (!Array.isArray(events) || events.length < 1 || events.length > MAX_EVENTS) {
      return errorBody(
        400,
        'Bad Request',
        `El reporte debe traer de 1 a ${String(MAX_EVENTS)} eventos.`,
      );
    }
    return new HttpResponse(null, { status: 202 });
  }),
];
