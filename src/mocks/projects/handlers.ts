import { delay, http, HttpResponse } from 'msw';
import { PROJECTS_ENDPOINT } from '@/features/projects/api/projectsApi';
import type { Project, ProjectDetail } from '@/features/projects/model/project';
import { authorize, errorBody } from '../mockAuth';
import type { ProjectRecord } from './db';
import { readProjectsDb } from './db';

/** Lo que ve el cliente en el detalle: la convocatoria sin su empresa dueña ni su fecha interna. */
function toDetail(record: ProjectRecord): ProjectDetail {
  return {
    id: record.id,
    title: record.title,
    area: record.area,
    cohort: record.cohort,
    summary: record.summary,
    capacity: record.capacity,
    occupied: record.occupied,
    version: record.version,
    closesAt: record.closesAt,
    description: record.description,
    requirements: record.requirements,
    skills: record.skills,
  };
}

/** Lo que muestra el catálogo: sin el detalle largo de cada convocatoria. */
function toProject(detail: ProjectDetail): Project {
  const { id, title, area, cohort, summary, capacity, occupied, version, closesAt } = detail;
  return { id, title, area, cohort, summary, capacity, occupied, version, closesAt };
}

/**
 * Convocatorias internas (HU-BE-16). Solo las abiertas de la empresa de quien pide aparecen en el catálogo; cuál está
 * abierta y cuántos cupos quedan lo decide el servidor.
 */
export const projectHandlers = [
  http.get(`*${PROJECTS_ENDPOINT}`, async ({ request }) => {
    await delay();
    const user = authorize(request, 'EMPLEADO');
    if (user instanceof Response) {
      return user;
    }
    const now = Date.now();
    const open = readProjectsDb()
      .projects.filter(
        ({ closesAt, organization }) =>
          organization === user.organization && Date.parse(closesAt) > now,
      )
      .sort((a, b) => Date.parse(a.closesAt) - Date.parse(b.closesAt))
      .map(toProject);
    return HttpResponse.json(open);
  }),

  http.get<{ id: string }>(`*${PROJECTS_ENDPOINT}/:id`, async ({ request, params }) => {
    await delay();
    const user = authorize(request, 'EMPLEADO');
    if (user instanceof Response) {
      return user;
    }
    const project = readProjectsDb().projects.find(
      ({ id, organization }) => id === params.id && organization === user.organization,
    );
    if (project === undefined) {
      return errorBody(404, 'Not Found', 'Esta convocatoria no existe.');
    }
    return HttpResponse.json(toDetail(project));
  }),
];
