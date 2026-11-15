import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { server } from '@/mocks/server';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { ApiError } from '@/shared/api/errors';
import { buildSession } from '@/test/credentials';
import { sendTelemetry, TELEMETRY_ENDPOINT } from './telemetryApi';

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

  describe('contrato simulado de vistas e interacción (propuesta a HU-BE-25)', () => {
    beforeEach(() => {
      configureHttpAuth({
        accessToken: buildSession('EMPLEADO').accessToken,
        renew: () => Promise.resolve(null),
      });
    });

    it('acepta una vista y un tiempo de interacción con ruta saneada', async () => {
      await expect(
        sendTelemetry({
          events: [
            { type: 'vista', route: '/empleado/mis-citas' },
            { type: 'interaccion', route: '/empleado/mis-citas', seconds: 42 },
          ],
        }),
      ).resolves.toBeUndefined();
    });

    it.each([
      ['una vista sin ruta', { type: 'vista' }],
      ['una vista con identificadores en la ruta', { type: 'vista', route: '/empleado/usr-001' }],
      ['una interacción sin segundos', { type: 'interaccion', route: '/empleado/mis-citas' }],
      [
        'una interacción de cero segundos',
        { type: 'interaccion', route: '/empleado/mis-citas', seconds: 0 },
      ],
      [
        'una interacción de más de 30 minutos',
        { type: 'interaccion', route: '/empleado/mis-citas', seconds: 1801 },
      ],
      [
        'una interacción con segundos decimales',
        { type: 'interaccion', route: '/empleado/mis-citas', seconds: 1.5 },
      ],
    ])('rechaza %s', async (_caso, event) => {
      await expect(sendTelemetry({ events: [event] })).rejects.toMatchObject({ status: 400 });
    });
  });
});
