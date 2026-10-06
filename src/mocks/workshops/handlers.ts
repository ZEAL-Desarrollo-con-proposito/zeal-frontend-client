import { delay, http, HttpResponse } from 'msw';
import { MY_ENROLLMENTS_ENDPOINT, WORKSHOPS_ENDPOINT } from '@/features/workshops/api/workshopsApi';
import type { Enrollment } from '@/features/workshops/model/enrollment';
import { ENROLLMENTS_QUEUE } from '@/features/workshops/model/enrollment';
import type { Workshop } from '@/features/workshops/model/workshop';
import { bySoonest } from '@/features/workshops/model/workshop';
import { authorize, errorBody } from '../mockAuth';
import { publishToUser } from '../realtime';
import type { EnrollmentRecord, WorkshopRecord } from './db';
import { publishWorkshopSpots, readWorkshopsDb, writeWorkshopsDb } from './db';

/** Lo que ve el cliente: el taller sin su empresa dueña. */
function toWorkshop(record: WorkshopRecord): Workshop {
  const { id, title, summary, facilitator, capacity, occupied, version, startsAt, endsAt } = record;
  return { id, title, summary, facilitator, capacity, occupied, version, startsAt, endsAt };
}

function toEnrollment(record: EnrollmentRecord, workshop: Workshop): Enrollment {
  const { id, workshopId, createdAt, version } = record;
  const { title, facilitator, startsAt, endsAt } = workshop;
  return {
    id,
    workshopId,
    workshopTitle: title,
    facilitator,
    startsAt,
    endsAt,
    createdAt,
    version,
  };
}

/**
 * Talleres comunitarios (HU-BE-18). Solo se listan los próximos de la empresa de quien pide.
 * Revisar el cupo y tomarlo ocurre sin pausas intermedias y en una sola escritura: nunca hay más
 * inscritos que capacidad; quien llega cuando ya no queda recibe un 409 con el motivo.
 */
export const workshopHandlers = [
  http.get(`*${WORKSHOPS_ENDPOINT}`, async ({ request }) => {
    await delay();
    const user = authorize(request, 'EMPLEADO');
    if (user instanceof Response) {
      return user;
    }
    const now = Date.now();
    const upcoming = readWorkshopsDb()
      .workshops.filter(
        ({ organization, startsAt }) =>
          organization === user.organization && Date.parse(startsAt) > now,
      )
      .sort(bySoonest)
      .map(toWorkshop);
    return HttpResponse.json(upcoming);
  }),

  http.post<{ id: string }>(
    `*${WORKSHOPS_ENDPOINT}/:id/inscripciones`,
    async ({ request, params }) => {
      await delay();
      const user = authorize(request, 'EMPLEADO');
      if (user instanceof Response) {
        return user;
      }
      const db = readWorkshopsDb();
      const workshop = db.workshops.find(
        ({ id, organization }) => id === params.id && organization === user.organization,
      );
      if (workshop === undefined) {
        return errorBody(404, 'Not Found', 'Este taller no existe.');
      }
      // Idempotente: inscribirse dos veces (un reintento, otra pestaña) devuelve la misma inscripción.
      const existing = db.enrollments.find(
        ({ workshopId, userId }) => workshopId === workshop.id && userId === user.id,
      );
      if (existing !== undefined) {
        return HttpResponse.json(toEnrollment(existing, workshop));
      }
      if (Date.parse(workshop.startsAt) <= Date.now()) {
        return errorBody(409, 'Conflict', 'Este taller ya empezó.');
      }
      if (workshop.occupied >= workshop.capacity) {
        return errorBody(409, 'Conflict', 'Este taller ya no tiene cupos.');
      }

      db.sequence += 1;
      const record: EnrollmentRecord = {
        id: `inscripcion-${String(db.sequence)}`,
        workshopId: workshop.id,
        userId: user.id,
        createdAt: new Date().toISOString(),
        version: 1,
      };
      db.enrollments.push(record);
      workshop.occupied += 1;
      workshop.version += 1;
      writeWorkshopsDb(db);

      publishWorkshopSpots(workshop);
      const enrollment = toEnrollment(record, workshop);
      publishToUser(user.id, ENROLLMENTS_QUEUE, { type: 'INSCRIPCION', enrollment });
      return HttpResponse.json(enrollment, { status: 201 });
    },
  ),

  http.get(`*${MY_ENROLLMENTS_ENDPOINT}`, async ({ request }) => {
    await delay();
    const user = authorize(request, 'EMPLEADO');
    if (user instanceof Response) {
      return user;
    }
    const now = Date.now();
    const db = readWorkshopsDb();
    const mine = db.enrollments
      .filter(({ userId }) => userId === user.id)
      .flatMap((record) => {
        const workshop = db.workshops.find(({ id }) => id === record.workshopId);
        return workshop === undefined || Date.parse(workshop.endsAt) <= now
          ? []
          : [toEnrollment(record, workshop)];
      })
      .sort(bySoonest);
    return HttpResponse.json(mine);
  }),
];
