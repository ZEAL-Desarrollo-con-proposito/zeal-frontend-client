import { delay, http, HttpResponse } from 'msw';
import { MY_APPLICATIONS_ENDPOINT, PROJECTS_ENDPOINT } from '@/features/projects/api/projectsApi';
import type { Application } from '@/features/projects/model/application';
import { APPLICATIONS_QUEUE } from '@/features/projects/model/application';
import type { ProjectDetail } from '@/features/projects/model/project';
import { authorize, errorBody } from '../mockAuth';
import { publishToUser } from '../realtime';
import type { ApplicationRecord } from './db';
import { publishSpots, readProjectsDb, writeProjectsDb } from './db';

function toApplication(record: ApplicationRecord, project: ProjectDetail): Application {
  const { id, projectId, status, waitlistPosition, createdAt, version } = record;
  return {
    id,
    projectId,
    projectTitle: project.title,
    status,
    waitlistPosition,
    createdAt,
    version,
  };
}

/**
 * Postulaciones a convocatorias (HU-BE-17). Revisar el cupo y asignarlo ocurre sin pausas
 * intermedias y en una sola escritura: dos personas nunca reciben el mismo cupo; quien llega
 * cuando ya no queda, entra a la lista de espera con su puesto.
 */
export const applicationHandlers = [
  http.post<{ id: string }>(
    `*${PROJECTS_ENDPOINT}/:id/postulaciones`,
    async ({ request, params }) => {
      await delay();
      const user = authorize(request, 'EMPLEADO');
      if (user instanceof Response) {
        return user;
      }
      const db = readProjectsDb();
      const project = db.projects.find(({ id }) => id === params.id);
      if (project === undefined) {
        return errorBody(404, 'Not Found', 'Esta convocatoria no existe.');
      }
      // Idempotente: postularse dos veces (un reintento, otra pestaña) devuelve la misma postulación.
      const existing = db.applications.find(
        ({ projectId, userId }) => projectId === project.id && userId === user.id,
      );
      if (existing !== undefined) {
        return HttpResponse.json(toApplication(existing, project));
      }
      if (Date.parse(project.closesAt) <= Date.now()) {
        return errorBody(409, 'Conflict', 'Esta convocatoria ya cerró.');
      }

      const accepted = project.occupied < project.capacity;
      const waiting = db.applications.filter(
        ({ projectId, status }) => projectId === project.id && status === 'EN_ESPERA',
      );
      db.sequence += 1;
      const record: ApplicationRecord = {
        id: `postulacion-${String(db.sequence)}`,
        projectId: project.id,
        userId: user.id,
        status: accepted ? 'ACEPTADA' : 'EN_ESPERA',
        waitlistPosition: accepted ? null : waiting.length + 1,
        createdAt: new Date().toISOString(),
        version: 1,
      };
      db.applications.push(record);
      if (accepted) {
        project.occupied += 1;
        project.version += 1;
      }
      writeProjectsDb(db);

      if (accepted) {
        publishSpots(project);
      }
      const application = toApplication(record, project);
      publishToUser(user.id, APPLICATIONS_QUEUE, { type: 'POSTULACION', application });
      return HttpResponse.json(application, { status: 201 });
    },
  ),

  http.get(`*${MY_APPLICATIONS_ENDPOINT}`, async ({ request }) => {
    await delay();
    const user = authorize(request, 'EMPLEADO');
    if (user instanceof Response) {
      return user;
    }
    const db = readProjectsDb();
    const mine = db.applications
      .filter(({ userId }) => userId === user.id)
      .flatMap((record) => {
        const project = db.projects.find(({ id }) => id === record.projectId);
        return project === undefined ? [] : [toApplication(record, project)];
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return HttpResponse.json(mine);
  }),
];
