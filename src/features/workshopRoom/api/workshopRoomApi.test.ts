import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { server } from '@/mocks/server';
import { ApiError, InvalidResponseError } from '@/shared/api/errors';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { buildSession } from '@/test/credentials';
import { fetchWorkshopRoom, workshopRoomEndpoint } from './workshopRoomApi';

afterEach(() => {
  configureHttpAuth(null);
});

describe('workshopRoomApi', () => {
  it('pide la sala como sub-recurso del taller', () => {
    expect(workshopRoomEndpoint('taller/1')).toBe('/api/talleres/taller%2F1/sala');
  });

  it('a quien no está inscrito el servidor no le entrega la sala', async () => {
    configureHttpAuth({
      accessToken: buildSession('EMPLEADO').accessToken,
      renew: () => Promise.resolve(null),
    });
    const error = await fetchWorkshopRoom('taller-impostor').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
  });

  it('descarta una respuesta con otro formato', async () => {
    server.use(http.get(`*${workshopRoomEndpoint('taller-1')}`, () => HttpResponse.json({})));
    await expect(fetchWorkshopRoom('taller-1')).rejects.toBeInstanceOf(InvalidResponseError);
  });
});
