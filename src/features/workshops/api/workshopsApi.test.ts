import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Role } from '@/features/auth/model/session';
import { createMockToken } from '@/mocks/mockToken';
import { SEED_USERS } from '@/mocks/seedUsers';
import { server } from '@/mocks/server';
import { readWorkshopsDb, writeWorkshopsDb } from '@/mocks/workshops/db';
import { InvalidResponseError } from '@/shared/api/errors';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { freezeTime } from '@/test/clock';
import { buildSession } from '@/test/credentials';
import {
  enrollInWorkshop,
  enrollmentsEndpoint,
  fetchMyEnrollments,
  fetchWorkshops,
  MY_ENROLLMENTS_ENDPOINT,
  WORKSHOPS_ENDPOINT,
} from './workshopsApi';

const IMPOSTOR = 'taller-impostor';

function authenticateAs(role: Role) {
  configureHttpAuth({
    accessToken: buildSession(role).accessToken,
    onUnauthorized: () => undefined,
  });
}

/** Mariana Torres, la segunda empleada semilla: compite por los mismos cupos que David. */
function authenticateAsMariana() {
  const mariana = SEED_USERS.find(({ id }) => id === 'usr-empleado-002');
  if (mariana === undefined) {
    throw new Error('Falta la empleada semilla Mariana Torres');
  }
  configureHttpAuth({ accessToken: createMockToken(mariana), onUnauthorized: () => undefined });
}

async function failure(promise: Promise<unknown>): Promise<unknown> {
  return promise.catch((caught: unknown) => caught);
}

describe('workshopsApi (contrato con HU-BE-18)', () => {
  beforeEach(() => {
    freezeTime();
  });

  afterEach(() => {
    configureHttpAuth(null);
  });

  it('lista los talleres próximos de la empresa, del más cercano al más lejano', async () => {
    authenticateAs('EMPLEADO');

    const workshops = await fetchWorkshops();

    expect(workshops.map(({ id }) => id)).toEqual([
      'taller-malestar-agil',
      'taller-limites-sanos',
      IMPOSTOR,
      'taller-descanso-real',
      'taller-conversaciones-dificiles',
      'taller-mentoria-inversa',
      'taller-primeros-auxilios',
    ]);
    expect(workshops[0]).not.toHaveProperty('organization');
    expect(workshops[0]).toMatchObject({ capacity: 30, occupied: 12, version: 1 });
  });

  it('inscribe tomando un cupo; repetirla devuelve la misma inscripción', async () => {
    authenticateAs('EMPLEADO');

    const enrollment = await enrollInWorkshop(IMPOSTOR);

    expect(enrollment).toMatchObject({
      workshopId: IMPOSTOR,
      workshopTitle: 'Síndrome del impostor en tu primer empleo',
      facilitator: 'Andrés Rojas',
      version: 1,
    });
    expect(readWorkshopsDb().workshops.find(({ id }) => id === IMPOSTOR)).toMatchObject({
      occupied: 30,
      version: 2,
    });
    await expect(enrollInWorkshop(IMPOSTOR)).resolves.toEqual(enrollment);
    await expect(fetchMyEnrollments()).resolves.toEqual([enrollment]);
  });

  it('dos personas por el último cupo: solo una lo obtiene, nunca hay sobreasignación', async () => {
    authenticateAs('EMPLEADO');
    await enrollInWorkshop(IMPOSTOR);

    authenticateAsMariana();

    await expect(failure(enrollInWorkshop(IMPOSTOR))).resolves.toMatchObject({
      status: 409,
      serverMessage: 'Este taller ya no tiene cupos.',
    });
    await expect(fetchMyEnrollments()).resolves.toEqual([]);
    expect(readWorkshopsDb().workshops.find(({ id }) => id === IMPOSTOR)).toMatchObject({
      capacity: 30,
      occupied: 30,
    });
  });

  it('rechaza talleres que ya empezaron, que no existen o de otra empresa', async () => {
    authenticateAs('EMPLEADO');

    await expect(failure(enrollInWorkshop('taller-en-curso'))).resolves.toMatchObject({
      status: 409,
      serverMessage: 'Este taller ya empezó.',
    });
    await expect(failure(enrollInWorkshop('no-existe'))).resolves.toMatchObject({ status: 404 });
    await expect(failure(enrollInWorkshop('taller-otra-empresa'))).resolves.toMatchObject({
      status: 404,
    });
  });

  it('Mis talleres no incluye los que ya terminaron', async () => {
    authenticateAs('EMPLEADO');
    await enrollInWorkshop(IMPOSTOR);
    const db = readWorkshopsDb();
    db.enrollments.push({
      id: 'inscripcion-vieja',
      workshopId: 'taller-en-curso',
      userId: 'usr-empleado-001',
      createdAt: new Date(2026, 8, 20).toISOString(),
      version: 1,
    });
    const started = db.workshops.find(({ id }) => id === 'taller-en-curso');
    if (started !== undefined) {
      started.endsAt = new Date(2026, 8, 23, 9).toISOString();
    }
    writeWorkshopsDb(db);

    const mine = await fetchMyEnrollments();

    expect(mine.map(({ workshopId }) => workshopId)).toEqual([IMPOSTOR]);
  });

  it('protege los talleres con autenticación y rol de empleado', async () => {
    await expect(failure(fetchWorkshops())).resolves.toMatchObject({ status: 401 });

    authenticateAs('PSICOLOGO');
    await expect(failure(fetchWorkshops())).resolves.toMatchObject({ status: 403 });
    await expect(failure(enrollInWorkshop(IMPOSTOR))).resolves.toMatchObject({ status: 403 });
    await expect(failure(fetchMyEnrollments())).resolves.toMatchObject({ status: 403 });
  });

  it('valida las respuestas y codifica el taller en la ruta', async () => {
    let path = '';
    server.use(
      http.get(`*${WORKSHOPS_ENDPOINT}`, () => HttpResponse.json([{ id: 't' }])),
      http.post(`*${WORKSHOPS_ENDPOINT}/:id/inscripciones`, ({ request }) => {
        path = new URL(request.url).pathname;
        return HttpResponse.json({ id: 'i' });
      }),
      http.get(`*${MY_ENROLLMENTS_ENDPOINT}`, () => HttpResponse.json({})),
    );

    await expect(fetchWorkshops()).rejects.toBeInstanceOf(InvalidResponseError);
    await expect(enrollInWorkshop('a/b')).rejects.toBeInstanceOf(InvalidResponseError);
    await expect(fetchMyEnrollments()).rejects.toBeInstanceOf(InvalidResponseError);
    expect(path).toBe(enrollmentsEndpoint('a/b'));
  });
});
