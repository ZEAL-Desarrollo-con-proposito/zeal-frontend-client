import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { server } from '@/mocks/server';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { ApiError } from '@/shared/api/errors';
import { buildSession } from '@/test/credentials';
import {
  sendTelemetry,
  TELEMETRY_ENDPOINT,
  TELEMETRY_MAX_EVENTS,
  TELEMETRY_MAX_VALUE_MS,
} from './telemetryApi';

const REPORT = { events: [{ type: 'latencia', name: 'notificacion_recibida', valueMs: 180 }] };

describe('telemetryApi.sendTelemetry', () => {
  afterEach(() => {
    configureHttpAuth(null);
  });

  it('envía el reporte con el token de la sesión', async () => {
    let received: unknown = null;
    let authorization: string | null = null;
    server.use(
      http.post(`*${TELEMETRY_ENDPOINT}`, async ({ request }) => {
        received = await request.json();
        authorization = request.headers.get('Authorization');
        return new HttpResponse(null, { status: 204 });
      }),
    );
    configureHttpAuth({ accessToken: 'token-vigente', renew: () => Promise.resolve(null) });

    await sendTelemetry(REPORT);

    expect(received).toEqual(REPORT);
    expect(authorization).toBe('Bearer token-vigente');
  });

  it('el simulador lo acepta solo con sesión', async () => {
    await expect(sendTelemetry(REPORT)).rejects.toMatchObject({ status: 401 });

    configureHttpAuth({
      accessToken: buildSession('EMPLEADO').accessToken,
      renew: () => Promise.resolve(null),
    });
    await expect(sendTelemetry(REPORT, { keepalive: true })).resolves.toBeUndefined();
  });

  it('reutiliza el X-Request-Id del fallo que se está reportando', async () => {
    let sent: string | null = null;
    server.use(
      http.post(`*${TELEMETRY_ENDPOINT}`, ({ request }) => {
        sent = request.headers.get('X-Request-Id');
        return new HttpResponse(null, { status: 202 });
      }),
    );

    await sendTelemetry(REPORT, { requestId: 'fallo-12345678' });

    expect(sent).toBe('fallo-12345678');
  });

  it('entrega el error para que quien envía decida si lo descarta', async () => {
    server.use(http.post(`*${TELEMETRY_ENDPOINT}`, () => new HttpResponse(null, { status: 503 })));

    await expect(sendTelemetry(REPORT)).rejects.toBeInstanceOf(ApiError);
  });

  describe('contrato del backend (TelemetryBatch del Real-Time Gateway)', () => {
    beforeEach(() => {
      configureHttpAuth({
        accessToken: buildSession('EMPLEADO').accessToken,
        renew: () => Promise.resolve(null),
      });
    });

    it('acepta errores, uso y latencias, con ruta saneada y tiempos de 0 a 2 minutos', async () => {
      await expect(
        sendTelemetry({
          events: [
            { type: 'error', name: 'error_api', route: '/empleado/mis-citas' },
            { type: 'uso', name: 'vista', route: '/empleado/mis-citas' },
            {
              type: 'latencia',
              name: 'interaccion',
              route: '/empleado/mis-citas',
              valueMs: TELEMETRY_MAX_VALUE_MS,
            },
            { type: 'latencia', name: 'notificacion_recibida', valueMs: 0 },
          ],
        }),
      ).resolves.toBeUndefined();
    });

    const event = { type: 'uso', name: 'vista', route: '/empleado/mis-citas' };

    it.each([
      ['un evento que no es un objeto', [null]],
      ['un tipo fuera del contrato (la vista de antes)', [{ type: 'vista', route: '/empleado' }]],
      [
        'un tipo fuera del contrato (la interacción de antes)',
        [{ type: 'interaccion', route: '/empleado', seconds: 42 }],
      ],
      ['un evento sin nombre', [{ type: 'uso', route: '/empleado' }]],
      ['un nombre con mayúsculas', [{ ...event, name: 'Vista' }]],
      ['una ruta con identificadores', [{ ...event, route: '/empleado/usr-001' }]],
      ['una ruta que no es texto', [{ ...event, route: 7 }]],
      ['un valueMs que no es número', [{ ...event, valueMs: '42' }]],
      ['un valueMs con decimales', [{ ...event, valueMs: 1.5 }]],
      ['un valueMs negativo', [{ ...event, valueMs: -1 }]],
      ['un valueMs de más de 2 minutos', [{ ...event, valueMs: TELEMETRY_MAX_VALUE_MS + 1 }]],
      ['ningún evento', []],
      [
        `más de ${String(TELEMETRY_MAX_EVENTS)} eventos`,
        Array.from({ length: TELEMETRY_MAX_EVENTS + 1 }, () => event),
      ],
    ])('rechaza %s', async (_caso, events) => {
      await expect(sendTelemetry({ events })).rejects.toMatchObject({ status: 400 });
    });

    it('rechaza un cuerpo sin eventos', async () => {
      await expect(sendTelemetry({ reporte: [event] })).rejects.toMatchObject({ status: 400 });
    });
  });
});
