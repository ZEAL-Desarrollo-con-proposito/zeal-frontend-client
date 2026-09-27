import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Role } from '@/features/auth/model/session';
import { server } from '@/mocks/server';
import { readWellbeingDb, writeWellbeingDb } from '@/mocks/wellbeing/db';
import { InvalidResponseError } from '@/shared/api/errors';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { freezeTime } from '@/test/clock';
import { buildSession } from '@/test/credentials';
import { fetchMyAppointments, MY_APPOINTMENTS_ENDPOINT } from './appointmentsApi';

function authenticateAs(role: Role) {
  configureHttpAuth({
    accessToken: buildSession(role).accessToken,
    onUnauthorized: () => undefined,
  });
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
    // Las del lunes y el martes ya terminaron; la de las 9:00 de hoy sigue en curso.
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
