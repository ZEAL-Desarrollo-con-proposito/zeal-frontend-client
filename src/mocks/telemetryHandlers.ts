import { http, HttpResponse } from 'msw';
import {
  TELEMETRY_ENDPOINT,
  TELEMETRY_MAX_EVENTS,
  TELEMETRY_MAX_VALUE_MS,
} from '@/shared/telemetry/telemetryApi';
import { authenticate, errorBody } from './mockAuth';

/** Tamaño máximo de un reporte, como el límite del backend. */
const MAX_REPORT_BYTES = 16 * 1024;

/** Tipos de evento del contrato (`TelemetryBatch.Type` en el Real-Time Gateway). */
const EVENT_TYPES = new Set(['error', 'uso', 'latencia']);

/** Nombre de un evento: minúsculas, dígitos y guion bajo. */
const EVENT_NAME_PATTERN = /^[a-z0-9_]{1,40}$/;

/** Ruta del SPA sin identificadores. */
const TELEMETRY_ROUTE_PATTERN = /^(\/[a-z-]{1,30}){0,4}\/?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Motivo por el que un evento no cumple el contrato de `POST /api/telemetria`; `null` si lo
 * cumple. Valida lo mismo que el backend (`TelemetryBatch`): tipo y nombre obligatorios, ruta
 * opcional sin identificadores y `valueMs` opcional de 0 a 120 000.
 */
function rejectionOf(event: unknown): string | null {
  if (!isRecord(event) || typeof event.type !== 'string' || !EVENT_TYPES.has(event.type)) {
    return 'El tipo de evento no es error, uso ni latencia.';
  }
  if (typeof event.name !== 'string' || !EVENT_NAME_PATTERN.test(event.name)) {
    return 'Nombre inválido';
  }
  if (
    event.route !== undefined &&
    (typeof event.route !== 'string' || !TELEMETRY_ROUTE_PATTERN.test(event.route))
  ) {
    return 'Ruta inválida';
  }
  if (
    event.valueMs !== undefined &&
    (typeof event.valueMs !== 'number' ||
      !Number.isInteger(event.valueMs) ||
      event.valueMs < 0 ||
      event.valueMs > TELEMETRY_MAX_VALUE_MS)
  ) {
    return 'valueMs debe estar entre 0 y 120000.';
  }
  return null;
}

/**
 * Endpoint de telemetría simulado (HU-BE-25), con las mismas reglas que el backend: solo con sesión,
 * `{ events: [1 a 20] }` con eventos válidos y límite de tamaño. Acepta el reporte sin guardarlo; en
 * el navegador se ve en la pestaña de red de las herramientas.
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
    const events = isRecord(report) ? report.events : null;
    if (!Array.isArray(events) || events.length < 1 || events.length > TELEMETRY_MAX_EVENTS) {
      return errorBody(
        400,
        'Bad Request',
        `El reporte debe traer de 1 a ${String(TELEMETRY_MAX_EVENTS)} eventos.`,
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
