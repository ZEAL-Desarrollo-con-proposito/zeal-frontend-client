import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { server } from '@/mocks/server';
import { ApiError, InvalidResponseError } from '@/shared/api/errors';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { buildSession } from '@/test/credentials';
import type { Role } from '@/features/auth/model/session';
import {
  createSlot,
  deleteSlot,
  fetchMySlots,
  MY_SLOTS_ENDPOINT,
  SLOTS_ENDPOINT,
} from './availabilityApi';

const WEEK = { from: new Date(2026, 8, 21), to: new Date(2026, 8, 25) };

function authenticateAs(role: Role) {
  configureHttpAuth({
    accessToken: buildSession(role).accessToken,
    onUnauthorized: () => undefined,
  });
}

describe('availabilityApi.fetchMySlots', () => {
  afterEach(() => {
    configureHttpAuth(null);
  });

  it('pide el rango de días como AAAA-MM-DD', async () => {
    let query = '';
    server.use(
      http.get(`*${MY_SLOTS_ENDPOINT}`, ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json([]);
      }),
    );

    await expect(fetchMySlots(WEEK)).resolves.toEqual([]);
    expect(query).toBe('?desde=2026-09-21&hasta=2026-09-25');
  });

  it('rechaza una respuesta que no cumple el contrato', async () => {
    server.use(http.get(`*${MY_SLOTS_ENDPOINT}`, () => HttpResponse.json([{ id: 'x' }])));

    await expect(fetchMySlots(WEEK)).rejects.toBeInstanceOf(InvalidResponseError);
  });

  it('el servidor exige sesión y rol de psicólogo', async () => {
    await expect(fetchMySlots(WEEK)).rejects.toMatchObject({ status: 401 });

    authenticateAs('EMPLEADO');
    await expect(fetchMySlots(WEEK)).rejects.toEqual(
      new ApiError(403, 'No tienes permiso para esta operación.'),
    );
  });

  it.each(['?desde=ayer', ''])(
    'el servidor exige un rango de fechas válido (%j)',
    async (search) => {
      const response = await fetch(
        new URL(`${MY_SLOTS_ENDPOINT}${search}`, window.location.origin),
        {
          headers: { Authorization: `Bearer ${buildSession('PSICOLOGO').accessToken}` },
        },
      );

      expect(response.status).toBe(400);
    },
  );

  it('createSlot rechaza una respuesta que no cumple el contrato', async () => {
    server.use(
      http.post(`*${SLOTS_ENDPOINT}`, () => HttpResponse.json({ id: 'x' }, { status: 201 })),
    );

    await expect(
      createSlot({ startsAt: '2026-09-23T15:00:00.000Z', endsAt: '2026-09-23T16:00:00.000Z' }),
    ).rejects.toBeInstanceOf(InvalidResponseError);
  });

  it('el servidor rechaza horas que no son fechas y exige sesión', async () => {
    await expect(createSlot({ startsAt: 'hoy', endsAt: 'mañana' })).rejects.toMatchObject({
      status: 401,
    });

    authenticateAs('PSICOLOGO');

    await expect(createSlot({ startsAt: 'hoy', endsAt: 'mañana' })).rejects.toEqual(
      new ApiError(400, 'La hora de fin debe ser posterior a la de inicio'),
    );
  });

  it('el servidor rechaza un cuerpo sin horas', async () => {
    const response = await fetch(new URL(SLOTS_ENDPOINT, window.location.origin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buildSession('PSICOLOGO').accessToken}`,
      },
      body: JSON.stringify({ startsAt: 1 }),
    });

    expect(response.status).toBe(400);
  });

  it('deleteSlot exige sesión y responde 404 si la franja no existe', async () => {
    await expect(deleteSlot('franja-1')).rejects.toMatchObject({ status: 401 });

    authenticateAs('PSICOLOGO');
    await expect(deleteSlot('franja-inexistente')).rejects.toEqual(
      new ApiError(404, 'La franja ya no existe'),
    );
    await expect(deleteSlot('franja-2')).resolves.toBeUndefined();
  });
});
