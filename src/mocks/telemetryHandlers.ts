import { http, HttpResponse } from 'msw';
import { TELEMETRY_ENDPOINT } from '@/shared/telemetry/telemetryApi';
import { authenticate, errorBody } from './mockAuth';

/** Tamaño máximo de un reporte, como el límite que pondrá el backend (tarea 461). */
const MAX_REPORT_BYTES = 16 * 1024;

/**
 * Endpoint de telemetría simulado (HU-BE-25): solo con sesión y con límite de tamaño. Acepta el
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
    try {
      JSON.parse(body);
    } catch {
      return errorBody(400, 'Bad Request', 'El reporte no es JSON.');
    }
    return new HttpResponse(null, { status: 204 });
  }),
];
