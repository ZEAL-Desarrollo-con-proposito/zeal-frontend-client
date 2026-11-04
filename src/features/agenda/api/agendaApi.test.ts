import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Role } from '@/features/auth/model/session';
import { server } from '@/mocks/server';
import { InvalidResponseError } from '@/shared/api/errors';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { freezeTime } from '@/test/clock';
import { buildSession } from '@/test/credentials';
import { AGENDA_ENDPOINT, fetchAgenda } from './agendaApi';

const WEEK = { from: new Date(2026, 8, 21), to: new Date(2026, 8, 25) };

function authenticateAs(role: Role) {
  configureHttpAuth({
    accessToken: buildSession(role).accessToken,
    renew: () => Promise.resolve(null),
  });
}

describe('agendaApi.fetchAgenda', () => {
  beforeEach(() => {
    freezeTime();
  });

  afterEach(() => {
    configureHttpAuth(null);
  });

  it('pide el rango de días como AAAA-MM-DD', async () => {
    let query = '';
    server.use(
      http.get(`*${AGENDA_ENDPOINT}`, ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json([]);
      }),
    );

    await expect(fetchAgenda(WEEK)).resolves.toEqual([]);
    expect(query).toBe('?desde=2026-09-21&hasta=2026-09-25');
  });

  it('devuelve la agenda de la semana ordenada, con la ventana de ingreso que fija el servidor', async () => {
    authenticateAs('PSICOLOGO');

    const agenda = await fetchAgenda(WEEK);

    expect(agenda).toHaveLength(16);
    const starts = agenda.map(({ startsAt }) => Date.parse(startsAt));
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    const confirmed = agenda.find(({ status }) => status === 'CONFIRMADA');
    expect(confirmed).toMatchObject({
      joinOpensAt: new Date(2026, 8, 23, 8, 50).toISOString(),
      joinClosesAt: new Date(2026, 8, 23, 9, 50).toISOString(),
    });
    const cancelled = agenda.find(({ status }) => status === 'CANCELADA');
    expect(cancelled).toMatchObject({ joinOpensAt: null, joinClosesAt: null });
  });

  it('solo entrega la agenda a un psicólogo autenticado', async () => {
    await expect(fetchAgenda(WEEK)).rejects.toMatchObject({ status: 401 });
    authenticateAs('EMPLEADO');
    await expect(fetchAgenda(WEEK)).rejects.toMatchObject({ status: 404 });
  });

  it('exige el rango de fechas', async () => {
    authenticateAs('PSICOLOGO');
    const response = await fetch(new URL(AGENDA_ENDPOINT, window.location.origin), {
      headers: { Authorization: `Bearer ${buildSession('PSICOLOGO').accessToken}` },
    });
    expect(response.status).toBe(400);
  });

  it('rechaza una respuesta que no cumple el contrato', async () => {
    server.use(http.get(`*${AGENDA_ENDPOINT}`, () => HttpResponse.json([{ id: 'reserva-1' }])));
    await expect(fetchAgenda(WEEK)).rejects.toBeInstanceOf(InvalidResponseError);

    server.use(http.get(`*${AGENDA_ENDPOINT}`, () => HttpResponse.json({ items: [] })));
    await expect(fetchAgenda(WEEK)).rejects.toBeInstanceOf(InvalidResponseError);
  });
});
