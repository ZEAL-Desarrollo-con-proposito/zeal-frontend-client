import { delay, http, HttpResponse } from 'msw';
import { ADMIN_PROJECTS_ENDPOINT } from '@/features/projects/api/adminProjectsApi';
import type { AdminProject } from '@/features/projects/model/adminProject';
import { compareByNewest } from '@/features/projects/model/adminProject';
import { PROJECTS_QUEUE } from '@/features/projects/model/adminProjectEvent';
import { publishMockEvent } from '../realtime';
import { organizationProjectsTopic } from '@/features/projects/model/projectCatalogEvent';
import {
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  LABEL_MAX_LENGTH,
  LABEL_MIN_LENGTH,
  MAX_CAPACITY,
  MAX_LIST_ITEM_LENGTH,
  MAX_LIST_ITEMS,
  MIN_CAPACITY,
  SUMMARY_MAX_LENGTH,
  SUMMARY_MIN_LENGTH,
  TITLE_MAX_LENGTH,
  TITLE_MIN_LENGTH,
} from '@/features/projects/model/projectDraft';
import { normalizeForSearch } from '@/shared/lib/text';
import { authorize, errorBody } from '../mockAuth';
import { publishToUser } from '../realtime';
import { SEED_USERS } from '../seedUsers';
import type { ProjectRecord } from './db';
import { readProjectsDb, writeProjectsDb } from './db';

type Body = Record<string, unknown>;

function lengthWithin(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
}

function isTextList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_LIST_ITEMS &&
    value.every((item) => lengthWithin(item, 1, MAX_LIST_ITEM_LENGTH))
  );
}

/** Reglas de negocio del backend (HU-BE-14): el formulario las valida */
function rejectionFor(body: Body): string | null {
  if (!lengthWithin(body.title, TITLE_MIN_LENGTH, TITLE_MAX_LENGTH)) {
    return `El título debe tener entre ${String(TITLE_MIN_LENGTH)} y ${String(TITLE_MAX_LENGTH)} caracteres`;
  }
  if (
    !lengthWithin(body.area, LABEL_MIN_LENGTH, LABEL_MAX_LENGTH) ||
    !lengthWithin(body.cohort, LABEL_MIN_LENGTH, LABEL_MAX_LENGTH)
  ) {
    return `El área y la cohorte deben tener entre ${String(LABEL_MIN_LENGTH)} y ${String(LABEL_MAX_LENGTH)} caracteres`;
  }
  if (!lengthWithin(body.summary, SUMMARY_MIN_LENGTH, SUMMARY_MAX_LENGTH)) {
    return `El resumen debe tener entre ${String(SUMMARY_MIN_LENGTH)} y ${String(SUMMARY_MAX_LENGTH)} caracteres`;
  }
  const { description } = body;
  if (
    !Array.isArray(description) ||
    description.length === 0 ||
    !description.every((paragraph) => typeof paragraph === 'string' && paragraph.trim() !== '') ||
    !lengthWithin(description.join(''), DESCRIPTION_MIN_LENGTH, DESCRIPTION_MAX_LENGTH)
  ) {
    return `La descripción debe tener entre ${String(DESCRIPTION_MIN_LENGTH)} y ${String(DESCRIPTION_MAX_LENGTH)} caracteres`;
  }
  if (!isTextList(body.requirements) || !isTextList(body.skills)) {
    return `Los requisitos y las habilidades admiten hasta ${String(MAX_LIST_ITEMS)} elementos de ${String(MAX_LIST_ITEM_LENGTH)} caracteres`;
  }
  const { capacity } = body;
  if (
    typeof capacity !== 'number' ||
    !Number.isInteger(capacity) ||
    capacity < MIN_CAPACITY ||
    capacity > MAX_CAPACITY
  ) {
    return `Los cupos deben ser un número entero entre ${String(MIN_CAPACITY)} y ${String(MAX_CAPACITY)}`;
  }
  const closesAt = typeof body.closesAt === 'string' ? Date.parse(body.closesAt) : Number.NaN;
  if (Number.isNaN(closesAt) || closesAt <= Date.now()) {
    return 'La fecha límite debe ser posterior a este momento';
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

/** Lo que ve el administrador: la convocatoria sin su detalle largo ni su empresa. */
function toAdminProject(record: ProjectRecord): AdminProject {
  const { id, title, area, cohort, summary, capacity, occupied, version, closesAt, publishedAt } =
    record;
  return { id, title, area, cohort, summary, capacity, occupied, version, closesAt, publishedAt };
}

/**
 * Convocatorias de la empresa para su administrador (HU-BE-14): cada empresa solo ve y publica
 * las suyas. Lo publicado queda en la misma base que lee el catálogo del empleado.
 */
export const adminProjectHandlers = [
  http.get(`*${ADMIN_PROJECTS_ENDPOINT}`, async ({ request }) => {
    await delay();
    const admin = authorize(request, 'ADMIN');
    if (admin instanceof Response) {
      return admin;
    }
    const own = readProjectsDb()
      .projects.filter(({ organization }) => organization === admin.organization)
      .map(toAdminProject)
      .sort(compareByNewest);
    return HttpResponse.json(own);
  }),

  http.post(`*${ADMIN_PROJECTS_ENDPOINT}`, async ({ request }) => {
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
    const db = readProjectsDb();
    const repeated = db.projects.some(
      (project) =>
        project.organization === admin.organization &&
        Date.parse(project.closesAt) > Date.now() &&
        normalizeForSearch(project.title) === normalizeForSearch(title),
    );
    if (repeated) {
      return errorBody(409, 'Conflict', 'Ya tienes un proyecto abierto con ese título');
    }
    db.sequence += 1;
    const record: ProjectRecord = {
      id: `proyecto-${String(db.sequence)}`,
      organization: admin.organization,
      publishedAt: new Date().toISOString(),
      title,
      area: (body.area as string).trim(),
      cohort: (body.cohort as string).trim(),
      summary: (body.summary as string).trim(),
      capacity: body.capacity as number,
      occupied: 0,
      version: 1,
      closesAt: body.closesAt as string,
      description: (body.description as string[]).map((paragraph) => paragraph.trim()),
      requirements: (body.requirements as string[]).map((item) => item.trim()),
      skills: (body.skills as string[]).map((item) => item.trim()),
    };
    db.projects.push(record);
    writeProjectsDb(db);
    const project = toAdminProject(record);
    // Todos los administradores de la empresa (y solo ellos) se enteran al instante.
    for (const colleague of SEED_USERS) {
      if (colleague.role === 'ADMIN' && colleague.organization === admin.organization) {
        publishToUser(colleague.id, PROJECTS_QUEUE, { type: 'PUBLICADO', project });
      }
    }
    // Y toda la organización se entera por el topic público: el catálogo del empleado
    // se actualiza solo, sin recargar (HU-FE-16).
    publishMockEvent(organizationProjectsTopic(admin.organization), {
      type: 'PUBLICADO',
      project: record,
    });
    return HttpResponse.json(project, { status: 201 });
  }),
];
