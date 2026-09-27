import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Role } from '@/features/auth/model/session';
import { RESERVATIONS_ENDPOINT } from '@/features/agenda/api/agendaApi';
import { server } from '@/mocks/server';
import { readWellbeingDb, writeWellbeingDb } from '@/mocks/wellbeing/db';
import { InvalidResponseError } from '@/shared/api/errors';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { freezeTime } from '@/test/clock';
import { buildSession } from '@/test/credentials';
import {
  cancelAppointment,
  fetchMyAppointments,
  MY_APPOINTMENTS_ENDPOINT,
} from './appointmentsApi';

const MARGIN_24H = 25 * 60 * 60 * 1000;

/** Path de cancelación con comodín para el origen, alineado con el código de producción. */
function cancelPathFor(id: string): string {
  return `*${RESERVATIONS_ENDPOINT}/${encodeURIComponent(id)}/cancelar`;
}

function authenticateAs(role: Role) {
  configureHttpAuth({
    accessToken: buildSession(role).accessToken,
    onUnauthorized: () => undefined,
  });
}

function findCancelableReservation() {
  const db = readWellbeingDb();
  const now = Date.now();
  const reservation = db.reservations.find(
    (r) =>
      r.employee.id === 'usr-empleado-001' &&
      r.status === 'CONFIRMADA' &&
      Date.parse(r.startsAt) - now > MARGIN_24H,
  );
  if (reservation === undefined) {
    throw new Error('No hay cita cancelable (>24 h) en la semilla');
  }
  return reservation;
}

describe('appointmentsApi.fetchMyAppointments', () => {
  beforeEach(() => {
    freezeTime();
  });

  afterEach(() => {
    configureHttpAuth(null);
  });

  it('entrega solo las citas del empleado, por fecha, con el estado que decide el servidor', async () => {
    authenticateAs('EMPLEADO');

    const appointments = await fetchMyAppointments();

    expect(appointments).toHaveLength(12);
    const starts = appointments.map(({ startsAt }) => Date.parse(startsAt));
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(appointments.slice(0, 3).map(({ status }) => status)).toEqual([
      'FINALIZADA',
      'FINALIZADA',
      'CONFIRMADA',
    ]);
    expect(appointments[2]).toMatchObject({
      psychologist: { fullName: 'Laura Martínez', title: 'Psicóloga clínica' },
      startsAt: new Date(2026, 8, 23, 9).toISOString(),
    });
  });

  it('no lista citas de un psicólogo que ya no está en el directorio', async () => {
    authenticateAs('EMPLEADO');
    const db = readWellbeingDb();
    db.psychologists = db.psychologists.filter(({ id }) => id !== 'usr-psicologo-001');
    writeWellbeingDb(db);

    await expect(fetchMyAppointments()).resolves.toEqual([]);
  });

  it('solo las entrega a un empleado autenticado y valida la respuesta', async () => {
    await expect(fetchMyAppointments()).rejects.toMatchObject({ status: 401 });
    authenticateAs('PSICOLOGO');
    await expect(fetchMyAppointments()).rejects.toMatchObject({ status: 403 });

    server.use(http.get(`*${MY_APPOINTMENTS_ENDPOINT}`, () => HttpResponse.json([{ id: 1 }])));
    await expect(fetchMyAppointments()).rejects.toBeInstanceOf(InvalidResponseError);
    server.use(http.get(`*${MY_APPOINTMENTS_ENDPOINT}`, () => HttpResponse.json({ citas: [] })));
    await expect(fetchMyAppointments()).rejects.toBeInstanceOf(InvalidResponseError);
  });
});

describe('appointmentsApi.cancelAppointment', () => {
  beforeEach(() => {
    freezeTime();
    authenticateAs('EMPLEADO');
  });

  afterEach(() => {
    configureHttpAuth(null);
  });

  it('cancela una cita propia y devuelve la cita actualizada con estado CANCELADA', async () => {
    const reservation = findCancelableReservation();

    const cancelled = await cancelAppointment(reservation.id);

    expect(cancelled.status).toBe('CANCELADA');
    expect(cancelled.id).toBe(reservation.id);
    const updated = readWellbeingDb().reservations.find((r) => r.id === reservation.id);
    expect(updated?.status).toBe('CANCELADA');
  });

  it('rechaza cancelar una cita que no existe con 404', async () => {
    await expect(cancelAppointment('reserva-inexistente')).rejects.toMatchObject({ status: 404 });
  });

  it('rechaza cancelar si el servidor devuelve una respuesta mal formada', async () => {
    const reservation = findCancelableReservation();

    server.use(http.post(cancelPathFor(reservation.id), () => HttpResponse.json({ ok: true })));

    await expect(cancelAppointment(reservation.id)).rejects.toBeInstanceOf(InvalidResponseError);
  });

  it('exige autenticación para cancelar', async () => {
    configureHttpAuth(null);
    await expect(cancelAppointment('reserva-1')).rejects.toMatchObject({ status: 401 });
  });
});
