import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Role } from '@/features/auth/model/session';
import { server } from '@/mocks/server';
import { ApiError, InvalidResponseError } from '@/shared/api/errors';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { freezeTime } from '@/test/clock';
import { buildSession } from '@/test/credentials';
import {
  fetchDirectory,
  fetchUpcomingSlots,
  fetchPsychologist,
  PSYCHOLOGISTS_ENDPOINT,
} from './directoryApi';

const WEEK = { from: new Date(2026, 8, 21), to: new Date(2026, 8, 25) };

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

describe('directoryApi.fetchPsychologist', () => {
  beforeEach(() => {
    freezeTime();
  });

  afterEach(() => {
    configureHttpAuth(null);
  });

  it('entrega el perfil con su próximo bloque libre', async () => {
    authenticateAs('EMPLEADO');

    await expect(fetchPsychologist('usr-psicologo-002')).resolves.toMatchObject({
      fullName: 'Andrés Rojas',
      title: 'Psicólogo organizacional',
      nextFreeSlot: { startsAt: new Date(2026, 8, 23, 13).toISOString() },
    });
  });

  it('responde 404 si el psicólogo no está en el directorio', async () => {
    authenticateAs('EMPLEADO');

    const error: unknown = await fetchPsychologist('nadie').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 404,
      serverMessage: 'No encontramos a este psicólogo en el directorio',
    });
  });

  it('exige una sesión de empleado y valida la respuesta', async () => {
    await expect(fetchPsychologist('usr-psicologo-001')).rejects.toMatchObject({ status: 401 });

    authenticateAs('EMPLEADO');
    server.use(http.get(`*${PSYCHOLOGISTS_ENDPOINT}/:id`, () => HttpResponse.json({ id: 'x' })));
    await expect(fetchPsychologist('x')).rejects.toBeInstanceOf(InvalidResponseError);
  });
});

describe('directoryApi.fetchUpcomingSlots', () => {
  beforeEach(() => {
    freezeTime();
  });

  afterEach(() => {
    configureHttpAuth(null);
  });

  it('entrega los bloques del rango que aún no empiezan, libres u ocupados, en orden', async () => {
    authenticateAs('EMPLEADO');

    const slots = await fetchUpcomingSlots('usr-psicologo-001', WEEK);

    // Miércoles desde las 9:20 (5) + jueves (7) + viernes (7); lunes y martes ya pasaron.
    expect(slots).toHaveLength(19);
    expect(slots.filter(({ status }) => status === 'DISPONIBLE')).toHaveLength(13);
    expect(slots[0]?.startsAt).toBe(new Date(2026, 8, 23, 10).toISOString());
    const starts = slots.map(({ startsAt }) => Date.parse(startsAt));
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it('pide el rango como AAAA-MM-DD en la ruta del psicólogo, codificada', async () => {
    let url = new URL('https://zeal.test');
    server.use(
      http.get(`*${PSYCHOLOGISTS_ENDPOINT}/:id/franjas`, ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json([]);
      }),
    );

    await expect(fetchUpcomingSlots('a/b', WEEK)).resolves.toEqual([]);
    expect(url.pathname).toBe(`${PSYCHOLOGISTS_ENDPOINT}/a%2Fb/franjas`);
    expect(url.search).toBe('?desde=2026-09-21&hasta=2026-09-25');
  });

  it('responde 404 para un psicólogo desconocido y 400 sin rango', async () => {
    authenticateAs('EMPLEADO');
    await expect(fetchUpcomingSlots('nadie', WEEK)).rejects.toMatchObject({ status: 404 });

    const response = await fetch(
      new URL(`${PSYCHOLOGISTS_ENDPOINT}/usr-psicologo-001/franjas`, window.location.origin),
      { headers: { Authorization: `Bearer ${buildSession('EMPLEADO').accessToken}` } },
    );
    expect(response.status).toBe(400);
  });

  it('exige una sesión de empleado y valida la respuesta', async () => {
    await expect(fetchUpcomingSlots('usr-psicologo-001', WEEK)).rejects.toMatchObject({
      status: 401,
    });

    server.use(
      http.get(`*${PSYCHOLOGISTS_ENDPOINT}/:id/franjas`, () => HttpResponse.json([{ id: 1 }])),
    );
    await expect(fetchUpcomingSlots('usr-psicologo-001', WEEK)).rejects.toBeInstanceOf(
      InvalidResponseError,
    );
  });
});
