import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/mocks/server';
import { ApiError, NetworkError } from './errors';
import { request } from './httpClient';

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
  ])('usa un mensaje genérico ante un error %s', async (_case, resolver) => {
    server.use(http.get(`*${ENDPOINT}`, resolver));

    const error: unknown = await request(ENDPOINT).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 500,
      message: 'Ocurrió un error inesperado. Intenta de nuevo.',
    });
  });

  it('lanza NetworkError cuando no hay conexión con el servidor', async () => {
    server.use(http.get(`*${ENDPOINT}`, () => HttpResponse.error()));

    await expect(request(ENDPOINT)).rejects.toBeInstanceOf(NetworkError);
  });
});
