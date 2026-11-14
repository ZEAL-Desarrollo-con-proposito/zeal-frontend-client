import { http, HttpResponse } from 'msw';
import { TELEMETRY_ENDPOINT } from '@/shared/telemetry/telemetryApi';
import { authenticate, errorBody } from './mockAuth';

/** Eventos por envío que acepta el backend. */
const MAX_EVENTS = 20;

/** Tamaño máximo de un reporte, como el límite que pondrá el backend (tarea 461). */
const MAX_REPORT_BYTES = 16 * 1024;

/** Ruta del SPA sin identificadores, según el contrato `POST /api/telemetria`. */
const TELEMETRY_ROUTE_PATTERN = /^(\/[a-z-]{1,30}){0,4}\/?$/;

/** Tiempo máximo de un tramo de interacción, igual que el que aplica el cliente. */
const MAX_INTERACTION_SECONDS = 1800;

function isTelemetryReport(value: unknown): value is { events: unknown } {
  return typeof value === 'object' && value !== null && 'events' in value;
}

function isErrorEvent(value: unknown): value is { type: 'error'; route?: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as { type?: unknown }).type === 'error'
  );
}

function isNavigationEvent(
  value: unknown,
): value is { type: 'vista' | 'interaccion'; route?: unknown; seconds?: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    ((value as { type?: unknown }).type === 'vista' ||
      (value as { type?: unknown }).type === 'interaccion')
  );
}

function isValidRoute(route: unknown): boolean {
  return typeof route === 'string' && TELEMETRY_ROUTE_PATTERN.test(route);
}

function isValidInteractionTime(seconds: unknown): boolean {
  return (
    typeof seconds === 'number' &&
    Number.isInteger(seconds) &&
    seconds >= 1 &&
    seconds <= MAX_INTERACTION_SECONDS
  );
}

/**
 * Motivo por el que un evento no cumple el contrato; `null` si lo cumple. Los errores y las vistas
 * llevan una ruta saneada (propuesta a HU-BE-25 para las vistas); la interacción suma de 1 s a
 * 30 min.
 */
function rejectionOf(event: unknown): string | null {
  if (isErrorEvent(event) && !isValidRoute(event.route)) {
    return 'La ruta del error no cumple el contrato.';
  }
  if (!isNavigationEvent(event)) {
    return null;
  }
  if (!isValidRoute(event.route)) {
    return 'La ruta de la vista no cumple el contrato.';
  }
  return event.type === 'interaccion' && !isValidInteractionTime(event.seconds)
    ? 'El tiempo de interacción no cumple el contrato.'
    : null;
}

/**
 * Endpoint de telemetría simulado (HU-BE-25): solo con sesión, `{ events: [1 a 20] }`, ruta válida para
 * errores y límite de tamaño. Acepta el reporte sin guardarlo; en el navegador se ve en la pestaña de
 * red de las herramientas.
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
    const events = isTelemetryReport(report) ? report.events : null;
    if (!Array.isArray(events) || events.length < 1 || events.length > MAX_EVENTS) {
      return errorBody(
        400,
        'Bad Request',
        `El reporte debe traer de 1 a ${String(MAX_EVENTS)} eventos.`,
      );
    }

    for (const event of events) {
      const rejection = rejectionOf(event);
      if (rejection !== null) {
        return errorBody(400, 'Bad Request', rejection);
      }
    }

    const correlationId = request.headers.get('X-Request-Id');
    return new HttpResponse(null, {
      status: 202,
      ...(correlationId ? { headers: { 'X-Request-Id': correlationId } } : {}),
    });
  }),
];
