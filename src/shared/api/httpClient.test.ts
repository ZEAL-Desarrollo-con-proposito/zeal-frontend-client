import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/mocks/server';
import { ApiError, NetworkError } from './errors';
import { configureHttpAuth, isAbortError, request } from './httpClient';

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

  it('lanza NetworkError cuando no hay conexión con el servidor', async () => {
    server.use(http.get(`*${ENDPOINT}`, () => HttpResponse.error()));

    await expect(request(ENDPOINT)).rejects.toBeInstanceOf(NetworkError);
  });
});
