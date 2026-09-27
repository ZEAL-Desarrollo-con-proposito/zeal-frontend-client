import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Role } from '@/features/auth/model/session';
import { server } from '@/mocks/server';
import { InvalidResponseError } from '@/shared/api/errors';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { freezeTime } from '@/test/clock';
import { buildSession } from '@/test/credentials';
import { fetchDirectory, PSYCHOLOGISTS_ENDPOINT } from './directoryApi';

function authenticateAs(role: Role) {
  configureHttpAuth({
    accessToken: buildSession(role).accessToken,
    onUnauthorized: () => undefined,
  });
}

describe('directoryApi.fetchDirectory', () => {
  beforeEach(() => {
    freezeTime();
  });

  afterEach(() => {
    configureHttpAuth(null);
  });

  it('entrega el directorio con el próximo bloque libre, primero quien tiene espacio antes', async () => {
    authenticateAs('EMPLEADO');

    const directory = await fetchDirectory();

    expect(directory.map(({ fullName }) => fullName)).toEqual([
      'Laura Martínez',
      'Andrés Rojas',
      'Valeria Castro',
      'Camila Duarte',
    ]);
    // A las 9:20 la franja de las 9:00 ya empezó y la de las 8:00 está reservada.
    expect(directory[0]?.nextFreeSlot?.startsAt).toBe(new Date(2026, 8, 23, 10).toISOString());
    expect(directory[3]?.nextFreeSlot).toBeNull();
  });

  it('solo lo entrega a un empleado autenticado', async () => {
    await expect(fetchDirectory()).rejects.toMatchObject({ status: 401 });
    authenticateAs('PSICOLOGO');
    await expect(fetchDirectory()).rejects.toMatchObject({ status: 403 });
  });

  it('rechaza una respuesta que no cumple el contrato', async () => {
    server.use(http.get(`*${PSYCHOLOGISTS_ENDPOINT}`, () => HttpResponse.json([{ id: 'x' }])));
    await expect(fetchDirectory()).rejects.toBeInstanceOf(InvalidResponseError);

    server.use(http.get(`*${PSYCHOLOGISTS_ENDPOINT}`, () => HttpResponse.json({ items: [] })));
    await expect(fetchDirectory()).rejects.toBeInstanceOf(InvalidResponseError);
  });
});
