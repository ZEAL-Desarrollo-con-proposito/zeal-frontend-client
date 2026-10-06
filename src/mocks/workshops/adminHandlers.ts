import { delay, http, HttpResponse } from 'msw';
import { ADMIN_WORKSHOPS_ENDPOINT } from '@/features/workshops/api/adminWorkshopsApi';
import type { Workshop } from '@/features/workshops/model/workshop';
import { compareByNewest } from '@/features/workshops/model/workshop';
import {
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  MAX_CAPACITY,
  MAX_DURATION_MINUTES,
  MIN_CAPACITY,
  MIN_DURATION_MINUTES,
  TITLE_MAX_LENGTH,
  TITLE_MIN_LENGTH,
} from '@/features/workshops/model/workshopDraft';
import {
  organizationWorkshopsTopic,
  WORKSHOPS_QUEUE,
} from '@/features/workshops/model/workshopEvent';
import { normalizeForSearch } from '@/shared/lib/text';
import { authorize, errorBody } from '../mockAuth';
import { publishMockEvent, publishToUser } from '../realtime';
import { SEED_USERS } from '../seedUsers';
import type { WorkshopRecord } from './db';
import { readWorkshopsDb, writeWorkshopsDb } from './db';

type Body = Record<string, unknown>;

function lengthWithin(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
}

function isIntegerWithin(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/** Reglas de negocio del backend (HU-BE-15): el formulario las valida antes de enviar. */
function rejectionFor(body: Body): string | null {
  if (!lengthWithin(body.title, TITLE_MIN_LENGTH, TITLE_MAX_LENGTH)) {
    return `El título debe tener entre ${String(TITLE_MIN_LENGTH)} y ${String(TITLE_MAX_LENGTH)} caracteres`;
  }
  if (!lengthWithin(body.description, DESCRIPTION_MIN_LENGTH, DESCRIPTION_MAX_LENGTH)) {
    return `La descripción debe tener entre ${String(DESCRIPTION_MIN_LENGTH)} y ${String(DESCRIPTION_MAX_LENGTH)} caracteres`;
  }
  const startsAt = typeof body.startsAt === 'string' ? Date.parse(body.startsAt) : Number.NaN;
  if (Number.isNaN(startsAt) || startsAt <= Date.now()) {
    return 'El taller debe empezar en un momento posterior a este';
  }
  if (!isIntegerWithin(body.durationMinutes, MIN_DURATION_MINUTES, MAX_DURATION_MINUTES)) {
    return `La duración debe ser un número entero entre ${String(MIN_DURATION_MINUTES)} y ${String(MAX_DURATION_MINUTES)} minutos`;
  }
  if (!isIntegerWithin(body.capacity, MIN_CAPACITY, MAX_CAPACITY)) {
    return `La capacidad debe ser un número entero entre ${String(MIN_CAPACITY)} y ${String(MAX_CAPACITY)}`;
  }
  return null;
}

async function readBody(request: Request): Promise<Body> {
  try {
    const body: unknown = await request.json();
    return typeof body === 'object' && body !== null ? (body as Body) : {};
  } catch {
    return {};
  }
}

/** Lo que viaja al cliente: el taller sin la empresa a la que pertenece. */
function toWorkshop(record: WorkshopRecord): Workshop {
  const {
    id,
    title,
    description,
    startsAt,
    durationMinutes,
    capacity,
    occupied,
    version,
    publishedAt,
  } = record;
  return {
    id,
    title,
    description,
    startsAt,
    durationMinutes,
    capacity,
    occupied,
    version,
    publishedAt,
  };
}

/**
 * Talleres de la empresa para su administrador (HU-BE-15): cada empresa solo ve y publica los
 * suyos.
 */
export const adminWorkshopHandlers = [
  http.get(`*${ADMIN_WORKSHOPS_ENDPOINT}`, async ({ request }) => {
    await delay();
    const admin = authorize(request, 'ADMIN');
    if (admin instanceof Response) {
      return admin;
    }
    const own = readWorkshopsDb()
      .workshops.filter(({ organization }) => organization === admin.organization)
      .map(toWorkshop)
      .sort(compareByNewest);
    return HttpResponse.json(own);
  }),

  http.post(`*${ADMIN_WORKSHOPS_ENDPOINT}`, async ({ request }) => {
    await delay();
    const admin = authorize(request, 'ADMIN');
    if (admin instanceof Response) {
      return admin;
    }
    const body = await readBody(request);
    const rejection = rejectionFor(body);
    if (rejection !== null) {
      return errorBody(400, 'Bad Request', rejection);
    }
    const title = (body.title as string).trim();
    const db = readWorkshopsDb();
    const repeated = db.workshops.some(
      (workshop) =>
        workshop.organization === admin.organization &&
        Date.parse(workshop.startsAt) > Date.now() &&
        normalizeForSearch(workshop.title) === normalizeForSearch(title),
    );
    if (repeated) {
      return errorBody(409, 'Conflict', 'Ya tienes un taller próximo con ese título');
    }
    db.sequence += 1;
    const record: WorkshopRecord = {
      id: `taller-${String(db.sequence)}`,
      organization: admin.organization,
      publishedAt: new Date().toISOString(),
      title,
      description: (body.description as string).trim(),
      startsAt: body.startsAt as string,
      durationMinutes: body.durationMinutes as number,
      capacity: body.capacity as number,
      occupied: 0,
      version: 1,
    };
    db.workshops.push(record);
    writeWorkshopsDb(db);
    const workshop = toWorkshop(record);
    // Los demás administradores de la empresa (y solo ellos) se enteran por su cola privada.
    for (const colleague of SEED_USERS) {
      if (colleague.role === 'ADMIN' && colleague.organization === admin.organization) {
        publishToUser(colleague.id, WORKSHOPS_QUEUE, { type: 'PUBLICADO', workshop });
      }
    }
    // Y los empleados conectados de la organización reciben el aviso de convocatoria abierta.
    publishMockEvent(organizationWorkshopsTopic(admin.organization), {
      type: 'PUBLICADO',
      workshop,
    });
    return HttpResponse.json(workshop, { status: 201 });
  }),
];
