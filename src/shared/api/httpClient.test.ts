import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/mocks/server';
import { fixRetryJitter } from '@/test/server';
import { ApiError, NetworkError } from './errors';
import {
  configureHttpAuth,
  isAbortError,
  MAX_RETRIES,
  request,
  RETRY_BASE_DELAY_MS,
} from './httpClient';

const ENDPOINT = '/api/prueba';

describe('httpClient.request', () => {
  it('hace GET por defecto y devuelve el JSON de la respuesta', async () => {
    server.use(
      http.get(`*${ENDPOINT}`, ({ request: incoming }) =>
        HttpResponse.json({ contentType: incoming.headers.get('Content-Type') }),
      ),
    );

    await expect(request(ENDPOINT)).resolves.toEqual({ contentType: null });
  });

  it('agrega los parámetros de consulta y devuelve null ante un 204', async () => {
    let search = '';
    server.use(
      http.delete(`*${ENDPOINT}`, ({ request: incoming }) => {
        search = new URL(incoming.url).search;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await expect(
      request(ENDPOINT, { method: 'DELETE', query: { desde: '2026-09-21', motivo: 'a b' } }),
    ).resolves.toBeNull();
    expect(search).toBe('?desde=2026-09-21&motivo=a+b');
  });

  it('propaga la cancelación sin confundirla con un fallo de red', async () => {
    server.use(http.get(`*${ENDPOINT}`, () => HttpResponse.json({ ok: true })));
    const controller = new AbortController();
    controller.abort();

    const error: unknown = await request(ENDPOINT, { signal: controller.signal }).catch(
      (reason: unknown) => reason,
    );

    expect(isAbortError(error)).toBe(true);
    expect(error).not.toBeInstanceOf(NetworkError);
    expect(isAbortError(new Error('otro'))).toBe(false);
  });

  it('envía el cuerpo como JSON', async () => {
    server.use(
      http.post(`*${ENDPOINT}`, async ({ request: incoming }) =>
        HttpResponse.json({
          contentType: incoming.headers.get('Content-Type'),
          body: await incoming.json(),
        }),
      ),
    );

    await expect(request(ENDPOINT, { method: 'POST', body: { a: 1 } })).resolves.toEqual({
      contentType: 'application/json',
      body: { a: 1 },
    });
  });

  it('usa el mensaje del servidor cuando la respuesta es un error', async () => {
    server.use(
      http.get(`*${ENDPOINT}`, () =>
        HttpResponse.json({ message: 'Correo o contraseña incorrectos' }, { status: 401 }),
      ),
    );

    await expect(request(ENDPOINT)).rejects.toEqual(
      new ApiError(401, 'Correo o contraseña incorrectos'),
    );
  });

  it.each([
    ['sin cuerpo', () => new HttpResponse(null, { status: 500 })],
    ['con un mensaje vacío', () => HttpResponse.json({ message: ' ' }, { status: 500 })],
    ['con un cuerpo que no es objeto', () => HttpResponse.json('texto', { status: 500 })],
  ])('no inventa un mensaje del servidor ante un error %s', async (_case, resolver) => {
    server.use(http.get(`*${ENDPOINT}`, resolver));

    const error: unknown = await request(ENDPOINT).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 500,
      serverMessage: undefined,
      message: 'La petición falló con estado HTTP 500',
    });
  });

  describe('con una sesión configurada', () => {
    afterEach(() => {
      configureHttpAuth(null);
    });

    it('envía el token y avisa a la sesión cuando el servidor responde 401', async () => {
      const onUnauthorized = vi.fn();
      configureHttpAuth({ accessToken: 'token-123', onUnauthorized });
      server.use(
        http.get(`*${ENDPOINT}`, ({ request: incoming }) =>
          HttpResponse.json(
            { message: incoming.headers.get('Authorization') ?? 'sin token' },
            { status: 401 },
          ),
        ),
      );

      await expect(request(ENDPOINT)).rejects.toEqual(new ApiError(401, 'Bearer token-123'));
      expect(onUnauthorized).toHaveBeenCalledOnce();
    });

    it('no avisa a la sesión ante errores distintos de 401', async () => {
      const onUnauthorized = vi.fn();
      configureHttpAuth({ accessToken: 'token-123', onUnauthorized });
      server.use(http.get(`*${ENDPOINT}`, () => new HttpResponse(null, { status: 403 })));

      await expect(request(ENDPOINT)).rejects.toBeInstanceOf(ApiError);
      expect(onUnauthorized).not.toHaveBeenCalled();
    });
  });

  describe('cuando el servidor no está disponible', () => {
    beforeEach(() => {
      // Sin espera entre reintentos, salvo en las pruebas que la miden.
      fixRetryJitter(0);
    });

    /** Responde `failure` los primeros `failures` intentos y luego `{ ok: true }`. */
    function unavailableFirst(failures: number, failure: () => Response) {
      const attempts = { count: 0 };
      server.use(
        http.get(`*${ENDPOINT}`, () => {
          attempts.count += 1;
          return attempts.count <= failures ? failure() : HttpResponse.json({ ok: true });
        }),
      );
      return attempts;
    }

    it.each([502, 503, 504])(
      'repite una consulta que recibe %i hasta que una réplica sana responde',
      async (status) => {
        const attempts = unavailableFirst(MAX_RETRIES, () => new HttpResponse(null, { status }));

        await expect(request(ENDPOINT)).resolves.toEqual({ ok: true });
        expect(attempts.count).toBe(MAX_RETRIES + 1);
      },
    );

    it('repite una consulta que no llegó al servidor', async () => {
      const attempts = unavailableFirst(1, () => HttpResponse.error());

      await expect(request(ENDPOINT)).resolves.toEqual({ ok: true });
      expect(attempts.count).toBe(2);
    });

    it('si ninguna réplica responde, entrega el error del último intento', async () => {
      const attempts = unavailableFirst(Infinity, () =>
        HttpResponse.json({ message: 'ZEAL está en mantenimiento' }, { status: 503 }),
      );

      await expect(request(ENDPOINT)).rejects.toEqual(
        new ApiError(503, 'ZEAL está en mantenimiento'),
      );
      expect(attempts.count).toBe(MAX_RETRIES + 1);
    });

    it('lanza NetworkError cuando nunca hay conexión con el servidor', async () => {
      unavailableFirst(Infinity, () => HttpResponse.error());

      await expect(request(ENDPOINT)).rejects.toBeInstanceOf(NetworkError);
    });

    it.each([
      ['un envío sin conexión', 'POST', () => HttpResponse.error()],
      ['un envío con el servidor caído', 'PUT', () => new HttpResponse(null, { status: 503 })],
      ['un envío sin respuesta a tiempo', 'PATCH', () => new HttpResponse(null, { status: 504 })],
      [
        'una cancelación con el servidor caído',
        'DELETE',
        () => new HttpResponse(null, { status: 502 }),
      ],
      ['una consulta con un error interno', 'GET', () => new HttpResponse(null, { status: 500 })],
      ['una consulta de algo que no existe', 'GET', () => new HttpResponse(null, { status: 404 })],
    ] as const)('no repite %s', async (_case, method, failure) => {
      let attempts = 0;
      server.use(
        http.all(`*${ENDPOINT}`, () => {
          attempts += 1;
          return failure();
        }),
      );

      await expect(request(ENDPOINT, { method })).rejects.toBeInstanceOf(Error);
      expect(attempts).toBe(1);
    });

    it('espera cada vez más entre reintentos, al azar hasta el tope de cada uno', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      fixRetryJitter(0.5);
      const attempts = unavailableFirst(MAX_RETRIES, () => new HttpResponse(null, { status: 503 }));

      const pending = request(ENDPOINT);

      // Topes de 250, 500 y 1000 ms: con el azar a la mitad, espera 125, 250 y 500 ms.
      for (const [elapsed, expected] of [
        [0, 1],
        [RETRY_BASE_DELAY_MS / 2 - 1, 1],
        [1, 2],
        [RETRY_BASE_DELAY_MS - 1, 2],
        [1, 3],
        [RETRY_BASE_DELAY_MS * 2 - 1, 3],
        [1, 4],
      ] as const) {
        await vi.advanceTimersByTimeAsync(elapsed);
        expect(attempts.count).toBe(expected);
      }
      await expect(pending).resolves.toEqual({ ok: true });
    });

    it('si quien pidió cancela durante la espera, no vuelve a intentar', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const attempts = unavailableFirst(Infinity, () => new HttpResponse(null, { status: 503 }));
      fixRetryJitter(0.99);
      const controller = new AbortController();

      const pending = request(ENDPOINT, { signal: controller.signal }).catch(
        (reason: unknown) => reason,
      );
      await vi.advanceTimersByTimeAsync(0);
      expect(attempts.count).toBe(1);
      controller.abort();

      expect(isAbortError(await pending)).toBe(true);
      await vi.advanceTimersByTimeAsync(RETRY_BASE_DELAY_MS * 2 ** MAX_RETRIES);
      expect(attempts.count).toBe(1);
    });
  });
});
