import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Role } from '@/features/auth/model/session';
import { readProjectsDb, writeProjectsDb } from '@/mocks/projects/db';
import { server } from '@/mocks/server';
import { InvalidResponseError } from '@/shared/api/errors';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { freezeTime } from '@/test/clock';
import { buildSession } from '@/test/credentials';
import { fetchProject, fetchProjects, PROJECTS_ENDPOINT } from './projectsApi';

function authenticateAs(role: Role) {
  configureHttpAuth({
    accessToken: buildSession(role).accessToken,
    onUnauthorized: () => undefined,
  });
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
    await expect(failure(fetchProjects())).resolves.toMatchObject({ status: 403 });
    await expect(failure(fetchProject('proyecto-observabilidad'))).resolves.toMatchObject({
      status: 403,
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
