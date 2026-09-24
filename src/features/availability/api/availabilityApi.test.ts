import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { server } from '@/mocks/server';
import { ApiError, InvalidResponseError } from '@/shared/api/errors';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { buildSession } from '@/test/credentials';
import type { Role } from '@/features/auth/model/session';
import { fetchMySlots, MY_SLOTS_ENDPOINT } from './availabilityApi';

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
});
