import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Role } from '@/features/auth/model/session';
import { readWorkshopsDb, writeWorkshopsDb } from '@/mocks/workshops/db';
import { server } from '@/mocks/server';
import { InvalidResponseError } from '@/shared/api/errors';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { freezeTime } from '@/test/clock';
import { buildSession } from '@/test/credentials';
import { keepOnlyAdminSeedWorkshop } from '@/test/workshops';
import { ADMIN_WORKSHOPS_ENDPOINT, createWorkshop, fetchAdminWorkshops } from './adminWorkshopsApi';
import type { NewWorkshop } from './adminWorkshopsApi';

function authenticateAs(role: Role) {
  configureHttpAuth({
    accessToken: buildSession(role).accessToken,
    onUnauthorized: () => undefined,
  });
}

async function failure(promise: Promise<unknown>): Promise<unknown> {
  return promise.catch((caught: unknown) => caught);
}

const NEW_WORKSHOP: NewWorkshop = {
  title: 'Taller de respiración',
  description: 'Una sesión práctica para respirar mejor durante la jornada.',
  startsAt: new Date(2026, 9, 10, 15).toISOString(),
  durationMinutes: 60,
  capacity: 25,
};

describe('adminWorkshopsApi (contrato con HU-BE-15)', () => {
  beforeEach(() => {
    freezeTime();
    keepOnlyAdminSeedWorkshop();
  });

  afterEach(() => {
    configureHttpAuth(null);
  });

  it('lista los talleres propios de la empresa, más recientes primero', async () => {
    authenticateAs('ADMIN');
    const db = readWorkshopsDb();
    const [seed] = db.workshops;
    if (seed === undefined) {
      throw new Error('Falta el taller semilla en la base de datos simulada');
    }
    db.workshops.push({ ...seed, id: 'taller-otra-empresa', organization: 'Otra Empresa S.A.' });
    writeWorkshopsDb(db);

    const workshops = await fetchAdminWorkshops();

    expect(workshops.map(({ id }) => id)).toEqual(['taller-pausas-activas']);
    expect(workshops[0]).toMatchObject({
      title: 'Pausas activas y respiración',
      capacity: 30,
      occupied: 12,
      version: 1,
    });
    expect(workshops[0]).not.toHaveProperty('organization');
  });

  it('protege los talleres con autenticación y rol de administrador', async () => {
    await expect(failure(fetchAdminWorkshops())).resolves.toMatchObject({ status: 401 });
    await expect(failure(createWorkshop(NEW_WORKSHOP))).resolves.toMatchObject({ status: 401 });

    authenticateAs('PSICOLOGO');
    await expect(failure(fetchAdminWorkshops())).resolves.toMatchObject({ status: 403 });
    await expect(failure(createWorkshop(NEW_WORKSHOP))).resolves.toMatchObject({ status: 403 });
  });

  it('publica un taller nuevo para la empresa del administrador', async () => {
    authenticateAs('ADMIN');

    const created = await createWorkshop(NEW_WORKSHOP);

    expect(created).toMatchObject({
      id: 'taller-1',
      title: 'Taller de respiración',
      durationMinutes: 60,
      capacity: 25,
      occupied: 0,
      version: 1,
    });
    const db = readWorkshopsDb();
    expect(db.sequence).toBe(1);
    expect(db.workshops.map(({ id }) => id)).toEqual(['taller-pausas-activas', 'taller-1']);
    expect(db.workshops[1]).toMatchObject({ organization: 'Nexura S.A.S.' });
  });

  it('rechaza un taller que rompe las reglas de HU-BE-15', async () => {
    authenticateAs('ADMIN');

    await expect(failure(createWorkshop({ ...NEW_WORKSHOP, title: 'abc' }))).resolves.toMatchObject(
      {
        status: 400,
        serverMessage: 'El título debe tener entre 5 y 80 caracteres',
      },
    );
    await expect(
      failure(
        createWorkshop({ ...NEW_WORKSHOP, startsAt: new Date(2026, 8, 23, 8).toISOString() }),
      ),
    ).resolves.toMatchObject({
      status: 400,
      serverMessage: 'El taller debe empezar en un momento posterior a este',
    });
    expect(readWorkshopsDb().sequence).toBe(0);
  });

  it('evita duplicar un taller próximo con el mismo título', async () => {
    authenticateAs('ADMIN');
    await createWorkshop(NEW_WORKSHOP);

    await expect(
      failure(createWorkshop({ ...NEW_WORKSHOP, title: '  taller de respiracion  ' })),
    ).resolves.toMatchObject({
      status: 409,
      serverMessage: 'Ya tienes un taller próximo con ese título',
    });
    expect(readWorkshopsDb().sequence).toBe(1);
  });

  it('valida las respuestas del servidor', async () => {
    authenticateAs('ADMIN');
    server.use(
      http.get(`*${ADMIN_WORKSHOPS_ENDPOINT}`, () => HttpResponse.json([{ id: 'x' }])),
      http.post(`*${ADMIN_WORKSHOPS_ENDPOINT}`, () => HttpResponse.json({ id: 'x' })),
    );
    await expect(fetchAdminWorkshops()).rejects.toBeInstanceOf(InvalidResponseError);
    await expect(createWorkshop(NEW_WORKSHOP)).rejects.toBeInstanceOf(InvalidResponseError);

    server.use(http.get(`*${ADMIN_WORKSHOPS_ENDPOINT}`, () => HttpResponse.json({ id: 'x' })));
    await expect(fetchAdminWorkshops()).rejects.toBeInstanceOf(InvalidResponseError);
  });
});
