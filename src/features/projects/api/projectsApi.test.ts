import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@/features/auth/model/session';
import { createMockToken } from '@/mocks/mockToken';
import { readProjectsDb, writeProjectsDb } from '@/mocks/projects/db';
import { SEED_USERS } from '@/mocks/seedUsers';
import { server } from '@/mocks/server';
import { InvalidResponseError } from '@/shared/api/errors';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { freezeTime } from '@/test/clock';
import { buildSession } from '@/test/credentials';
import {
  applicationsEndpoint,
  applyToProject,
  fetchMyApplications,
  fetchProject,
  fetchProjects,
  MY_APPLICATIONS_ENDPOINT,
  PROJECTS_ENDPOINT,
} from './projectsApi';

function authenticateAs(role: Role) {
  configureHttpAuth({
    accessToken: buildSession(role).accessToken,
    renew: () => Promise.resolve(null),
  });
}

/** Mariana Torres, la segunda empleada semilla: compite por los mismos cupos que David. */
function authenticateAsMariana() {
  const mariana = SEED_USERS.find(({ id }) => id === 'usr-empleado-002');
  if (mariana === undefined) {
    throw new Error('Falta la empleada semilla Mariana Torres');
  }
  configureHttpAuth({ accessToken: createMockToken(mariana), renew: () => Promise.resolve(null) });
}

async function failure(promise: Promise<unknown>): Promise<unknown> {
  return promise.catch((caught: unknown) => caught);
}

describe('projectsApi (contrato con HU-BE-16)', () => {
  beforeEach(() => {
    freezeTime();
  });

  afterEach(() => {
    configureHttpAuth(null);
  });

  it('lista las convocatorias abiertas por fecha de cierre, sin su detalle largo', async () => {
    authenticateAs('EMPLEADO');
    const db = readProjectsDb();
    const [first] = db.projects;
    if (first !== undefined) {
      first.closesAt = new Date(2026, 8, 22).toISOString(); // Ya cerró: no se lista.
    }
    writeProjectsDb(db);

    const projects = await fetchProjects();

    expect(projects.map(({ title }) => title)).toEqual([
      'Data Platform · Turno de guardia',
      'Mentoría inversa Gen Z',
      'Accesibilidad en producto',
    ]);
    expect(projects[0]).not.toHaveProperty('description');
    expect(projects[0]).toMatchObject({ capacity: 4, occupied: 2, version: 1 });
  });

  it('entrega el detalle de una convocatoria', async () => {
    authenticateAs('EMPLEADO');

    await expect(fetchProject('proyecto-observabilidad')).resolves.toMatchObject({
      title: 'Squad de Observabilidad',
      requirements: expect.arrayContaining(['Manejo básico de logs y métricas']) as unknown,
    });
    await expect(failure(fetchProject('no-existe'))).resolves.toMatchObject({
      status: 404,
      serverMessage: 'Esta convocatoria no existe.',
    });
  });

  it('protege el catálogo con autenticación y rol de empleado', async () => {
    await expect(failure(fetchProjects())).resolves.toMatchObject({ status: 401 });

    authenticateAs('PSICOLOGO');
    await expect(failure(fetchProjects())).resolves.toMatchObject({ status: 404 });
    await expect(failure(fetchProject('proyecto-observabilidad'))).resolves.toMatchObject({
      status: 404,
    });
  });

  it('valida las respuestas y codifica la convocatoria en la ruta', async () => {
    let path = '';
    server.use(
      http.get(`*${PROJECTS_ENDPOINT}`, () => HttpResponse.json([{ id: 'p' }])),
      http.get(`*${PROJECTS_ENDPOINT}/:id`, ({ request }) => {
        path = new URL(request.url).pathname;
        return HttpResponse.json({ id: 'a/b' });
      }),
    );

    await expect(fetchProjects()).rejects.toBeInstanceOf(InvalidResponseError);
    await expect(fetchProject('a/b')).rejects.toBeInstanceOf(InvalidResponseError);
    expect(path).toBe('/api/proyectos/a%2Fb');
  });
});

describe('postulaciones (contrato con HU-BE-17)', () => {
  beforeEach(() => {
    freezeTime();
  });

  afterEach(() => {
    configureHttpAuth(null);
  });

  it('con cupo queda aceptada y ocupa un cupo; repetirla devuelve la misma', async () => {
    authenticateAs('EMPLEADO');

    const accepted = await applyToProject('proyecto-guardia-datos');

    expect(accepted).toMatchObject({
      projectId: 'proyecto-guardia-datos',
      projectTitle: 'Data Platform · Turno de guardia',
      status: 'ACEPTADA',
      waitlistPosition: null,
    });
    const project = readProjectsDb().projects.find(({ id }) => id === 'proyecto-guardia-datos');
    expect(project).toMatchObject({ occupied: 3, version: 2 });
    await expect(applyToProject('proyecto-guardia-datos')).resolves.toEqual(accepted);
    expect(readProjectsDb().applications).toHaveLength(1);
  });

  it('sin cupo queda en lista de espera, con su puesto, sin sobreasignar', async () => {
    authenticateAs('EMPLEADO');

    await expect(applyToProject('proyecto-observabilidad')).resolves.toMatchObject({
      status: 'EN_ESPERA',
      waitlistPosition: 1,
    });

    authenticateAsMariana();
    await expect(applyToProject('proyecto-observabilidad')).resolves.toMatchObject({
      status: 'EN_ESPERA',
      waitlistPosition: 2,
    });
    expect(
      readProjectsDb().projects.find(({ id }) => id === 'proyecto-observabilidad'),
    ).toMatchObject({ occupied: 3, capacity: 3 });
  });

  it('rechaza una convocatoria cerrada o inexistente, y a quien no es empleado', async () => {
    authenticateAs('EMPLEADO');
    const db = readProjectsDb();
    const [first] = db.projects;
    if (first !== undefined) {
      first.closesAt = new Date(2026, 8, 23, 8).toISOString();
    }
    writeProjectsDb(db);

    await expect(failure(applyToProject('proyecto-observabilidad'))).resolves.toMatchObject({
      status: 409,
      serverMessage: 'Esta convocatoria ya cerró.',
    });
    await expect(failure(applyToProject('no-existe'))).resolves.toMatchObject({ status: 404 });

    authenticateAs('PSICOLOGO');
    await expect(failure(applyToProject('proyecto-guardia-datos'))).resolves.toMatchObject({
      status: 404,
    });
    await expect(failure(fetchMyApplications())).resolves.toMatchObject({ status: 404 });
  });

  it('lista solo las postulaciones propias, las más recientes primero', async () => {
    authenticateAs('EMPLEADO');
    await applyToProject('proyecto-guardia-datos');
    vi.setSystemTime(new Date(2026, 8, 23, 10));
    await applyToProject('proyecto-accesibilidad');
    authenticateAsMariana();
    await applyToProject('proyecto-mentoria-inversa');

    authenticateAs('EMPLEADO');
    const mine = await fetchMyApplications();

    expect(mine.map(({ projectId }) => projectId)).toEqual([
      'proyecto-accesibilidad',
      'proyecto-guardia-datos',
    ]);
  });

  it('valida las respuestas y codifica la convocatoria en la ruta', async () => {
    let path = '';
    server.use(
      http.post(`*${PROJECTS_ENDPOINT}/:id/postulaciones`, ({ request }) => {
        path = new URL(request.url).pathname;
        return HttpResponse.json({ id: 'x' }, { status: 201 });
      }),
      http.get(`*${MY_APPLICATIONS_ENDPOINT}`, () => HttpResponse.json([{ id: 'x' }])),
    );

    await expect(applyToProject('a/b')).rejects.toBeInstanceOf(InvalidResponseError);
    await expect(fetchMyApplications()).rejects.toBeInstanceOf(InvalidResponseError);
    expect(path).toBe(applicationsEndpoint('a/b'));
    expect(path).toBe('/api/proyectos/a%2Fb/postulaciones');
  });
});
