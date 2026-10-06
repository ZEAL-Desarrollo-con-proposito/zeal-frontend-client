import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import type { Role } from '@/features/auth/model/session';
import { server } from '@/mocks/server';
import { ApiError, InvalidResponseError } from '@/shared/api/errors';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { buildSession } from '@/test/credentials';
import type { NewProject } from './adminProjectsApi';
import { ADMIN_PROJECTS_ENDPOINT, createProject, fetchAdminProjects } from './adminProjectsApi';
import { fetchProject, fetchProjects } from './projectsApi';

function authenticateAs(role: Role) {
  configureHttpAuth({
    accessToken: buildSession(role).accessToken,
    onUnauthorized: () => undefined,
  });
}

const VALID: NewProject = {
  title: 'Proyecto nuevo de prueba',
  area: 'Cultura',
  cohort: 'Semilla 2026-3',
  summary: 'Un resumen suficientemente largo.',
  description: ['Primer párrafo de la descripción.', 'Segundo párrafo.'],
  requirements: ['SQL'],
  skills: [],
  capacity: 3,
  closesAt: new Date(Date.now() + 3 * 24 * 60 * 60_000).toISOString(),
};

describe('adminProjectsApi', () => {
  afterEach(() => {
    configureHttpAuth(null);
  });

  it('el servidor exige sesión y rol de administrador', async () => {
    await expect(fetchAdminProjects()).rejects.toMatchObject({ status: 401 });
    authenticateAs('EMPLEADO');
    await expect(fetchAdminProjects()).rejects.toEqual(
      new ApiError(403, 'No tienes permiso para esta operación.'),
    );
    await expect(createProject(VALID)).rejects.toMatchObject({ status: 403 });
  });

  it('lista las convocatorias de la empresa (también las cerradas), la más reciente primero', async () => {
    authenticateAs('ADMIN');
    const projects = await fetchAdminProjects();
    expect(projects.map(({ id }) => id)).toEqual([
      'proyecto-observabilidad',
      'proyecto-mentoria-inversa',
      'proyecto-guardia-datos',
      'proyecto-accesibilidad',
      'proyecto-mentorias-cruzadas',
    ]);
    expect(projects.some(({ id }) => id === 'proyecto-otra-empresa')).toBe(false);
  });

  it('publica un proyecto y aparece en la lista del administrador', async () => {
    authenticateAs('ADMIN');
    const created = await createProject(VALID);
    expect(created).toMatchObject({ title: VALID.title, capacity: 3, occupied: 0, version: 1 });
    expect((await fetchAdminProjects())[0]).toEqual(created);
  });

  it('lo publicado llega al catálogo y al detalle del empleado, con todos sus datos', async () => {
    authenticateAs('ADMIN');
    const created = await createProject(VALID);

    authenticateAs('EMPLEADO');
    expect((await fetchProjects()).map(({ id }) => id)).toContain(created.id);
    expect(await fetchProject(created.id)).toMatchObject({
      title: VALID.title,
      description: VALID.description,
      requirements: VALID.requirements,
      skills: [],
    });
  });

  it('el empleado no ve los proyectos de otra empresa', async () => {
    authenticateAs('EMPLEADO');
    expect((await fetchProjects()).some(({ id }) => id === 'proyecto-otra-empresa')).toBe(false);
    await expect(fetchProject('proyecto-otra-empresa')).rejects.toMatchObject({ status: 404 });
  });

  it.each([
    ['título corto', { title: 'abc' }, 'El título debe tener entre 5 y 80 caracteres'],
    ['área vacía', { area: ' ' }, 'El área y la cohorte deben tener entre 2 y 40 caracteres'],
    ['resumen corto', { summary: 'corto' }, 'El resumen debe tener entre 10 y 140 caracteres'],
    [
      'sin descripción',
      { description: [] },
      'La descripción debe tener entre 20 y 1500 caracteres',
    ],
    ['capacidad 0', { capacity: 0 }, 'Los cupos deben ser un número entero entre 1 y 100'],
    ['capacidad decimal', { capacity: 2.5 }, 'Los cupos deben ser un número entero entre 1 y 100'],
    [
      'capacidad como texto',
      { capacity: '3' },
      'Los cupos deben ser un número entero entre 1 y 100',
    ],
    [
      'fecha pasada',
      { closesAt: '2020-01-01T00:00:00.000Z' },
      'La fecha límite debe ser posterior a este momento',
    ],
  ])('el servidor rechaza %s', async (_case, patch, message) => {
    authenticateAs('ADMIN');
    await expect(createProject({ ...VALID, ...patch } as never)).rejects.toEqual(
      new ApiError(400, message),
    );
  });

  it('rechaza un título repetido entre los abiertos de la empresa', async () => {
    authenticateAs('ADMIN');
    await expect(createProject({ ...VALID, title: 'squad de OBSERVABILIDAD' })).rejects.toEqual(
      new ApiError(409, 'Ya tienes un proyecto abierto con ese título'),
    );
    // Un título igual al de uno ya cerrado sí se puede volver a publicar.
    await expect(
      createProject({ ...VALID, title: 'Piloto de mentorías cruzadas' }),
    ).resolves.toMatchObject({ title: 'Piloto de mentorías cruzadas' });
  });

  it('rechaza respuestas que no cumplen el contrato', async () => {
    server.use(
      http.get(`*${ADMIN_PROJECTS_ENDPOINT}`, () => HttpResponse.json([{ id: 'x' }])),
      http.post(`*${ADMIN_PROJECTS_ENDPOINT}`, () =>
        HttpResponse.json({ id: 'x' }, { status: 201 }),
      ),
    );
    await expect(fetchAdminProjects()).rejects.toBeInstanceOf(InvalidResponseError);
    await expect(createProject(VALID)).rejects.toBeInstanceOf(InvalidResponseError);
  });
});
