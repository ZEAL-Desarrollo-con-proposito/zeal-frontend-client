import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
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

  it('entrega el error para que quien envía decida si lo descarta', async () => {
    server.use(http.post(`*${TELEMETRY_ENDPOINT}`, () => new HttpResponse(null, { status: 503 })));

    await expect(sendTelemetry(REPORT)).rejects.toBeInstanceOf(ApiError);
  });
});
