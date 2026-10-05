import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import type { Role } from '@/features/auth/model/session';
import { server } from '@/mocks/server';
import { InvalidResponseError } from '@/shared/api/errors';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { buildSession } from '@/test/credentials';
import { PRESENCE_ENDPOINT, fetchPresence, presenceEndpoint } from './presenceApi';

const PSYCHOLOGIST = 'usr-psicologo-001';

function path(): string {
  return `*${presenceEndpoint(PSYCHOLOGIST)}`;
}

function authenticateAs(role: Role) {
  configureHttpAuth({
    accessToken: buildSession(role).accessToken,
    onUnauthorized: () => undefined,
  });
}

describe('presenceApi.presenceEndpoint', () => {
  it('codifica la persona en la ruta de su presencia', () => {
    expect(PRESENCE_ENDPOINT).toBe('/api/presencia');
    expect(presenceEndpoint('a:b')).toBe('/api/presencia/a%3Ab');
  });
});

describe('presenceApi.fetchPresence', () => {
  afterEach(() => {
    configureHttpAuth(null);
  });

  it('entrega el estado que el servidor tiene ahora mismo', async () => {
    authenticateAs('EMPLEADO');
    server.use(
      http.get(path(), () => HttpResponse.json({ userId: PSYCHOLOGIST, status: 'online' })),
    );

    await expect(fetchPresence(PSYCHOLOGIST)).resolves.toBe('online');
  });

  it('sin una conexión registrada el simulador la da por desconectada', async () => {
    authenticateAs('EMPLEADO');

    await expect(fetchPresence(PSYCHOLOGIST)).resolves.toBe('offline');
  });

  it('rechaza una respuesta que no es una presencia', async () => {
    authenticateAs('EMPLEADO');
    server.use(http.get(path(), () => HttpResponse.json({ status: 'online' })));

    await expect(fetchPresence(PSYCHOLOGIST)).rejects.toBeInstanceOf(InvalidResponseError);
  });

  it('rechaza que la respuesta sea de otra persona', async () => {
    authenticateAs('EMPLEADO');
    server.use(
      http.get(path(), () => HttpResponse.json({ userId: 'usr-psicologo-999', status: 'online' })),
    );

    await expect(fetchPresence(PSYCHOLOGIST)).rejects.toBeInstanceOf(InvalidResponseError);
  });

  it('solo la pide quien tiene sesión', async () => {
    await expect(fetchPresence(PSYCHOLOGIST)).rejects.toMatchObject({ status: 401 });
  });

  it('cancela la petición en curso cuando quien la pidió la aborta', async () => {
    authenticateAs('EMPLEADO');
    const controller = new AbortController();
    controller.abort();

    await expect(fetchPresence(PSYCHOLOGIST, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
