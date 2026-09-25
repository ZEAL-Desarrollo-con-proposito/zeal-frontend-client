import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Role } from '@/features/auth/model/session';
import { server } from '@/mocks/server';
import { ApiError, InvalidResponseError } from '@/shared/api/errors';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { freezeTime } from '@/test/clock';
import { buildSession } from '@/test/credentials';
import { AGENDA_ENDPOINT, fetchAgenda, fetchReservation, RESERVATIONS_ENDPOINT } from './agendaApi';

const WEEK = { from: new Date(2026, 8, 21), to: new Date(2026, 8, 25) };

function authenticateAs(role: Role) {
  configureHttpAuth({
    accessToken: buildSession(role).accessToken,
    onUnauthorized: () => undefined,
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
    await expect(fetchAgenda(WEEK)).rejects.toMatchObject({ status: 403 });
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

describe('agendaApi.fetchReservation', () => {
  beforeEach(() => {
    freezeTime();
  });

  afterEach(() => {
    configureHttpAuth(null);
  });

  it('devuelve una reserva propia', async () => {
    authenticateAs('PSICOLOGO');

    await expect(fetchReservation('reserva-16')).resolves.toMatchObject({
      id: 'reserva-16',
      employee: { fullName: 'David Cajamarca' },
      status: 'CONFIRMADA',
    });
  });

  it('responde 404 si la reserva no existe o no es del psicólogo', async () => {
    authenticateAs('PSICOLOGO');

    const error: unknown = await fetchReservation('reserva-999').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 404,
      serverMessage: 'Esta sesión no existe o no es tuya',
    });
  });

  it('protege la reserva con autenticación y rol', async () => {
    await expect(fetchReservation('reserva-16')).rejects.toMatchObject({ status: 401 });
  });

  it('codifica el id en la ruta y valida la respuesta', async () => {
    let path = '';
    server.use(
      http.get(`*${RESERVATIONS_ENDPOINT}/:id`, ({ request }) => {
        path = new URL(request.url).pathname;
        return HttpResponse.json({ id: 'a/b' });
      }),
    );

    await expect(fetchReservation('a/b')).rejects.toBeInstanceOf(InvalidResponseError);
    expect(path).toBe(`${RESERVATIONS_ENDPOINT}/a%2Fb`);
  });
});
