import { InvalidResponseError } from '@/shared/api/errors';
import { request } from '@/shared/api/httpClient';
import type { Enrollment } from '../model/enrollment';
import { isEnrollment } from '../model/enrollment';
import type { Workshop } from '../model/workshop';
import { isWorkshop } from '../model/workshop';

export const WORKSHOPS_ENDPOINT = '/api/talleres';
export const MY_ENROLLMENTS_ENDPOINT = '/api/inscripciones/mias';

/** Ruta para inscribirse a un taller. */
export function enrollmentsEndpoint(workshopId: string): string {
  return `${WORKSHOPS_ENDPOINT}/${encodeURIComponent(workshopId)}/inscripciones`;
}

/** Talleres que aún no terminan, con sus cupos actuales (HU-BE-18). */
export async function fetchWorkshops(signal?: AbortSignal): Promise<Workshop[]> {
  const payload = await request(WORKSHOPS_ENDPOINT, { signal });
  if (!Array.isArray(payload) || !payload.every(isWorkshop)) {
    throw new InvalidResponseError('los talleres');
  }
  return payload;
}

/**
 * Inscribe a la persona. El servidor decide de forma atómica si queda un cupo; si no, responde
 * 409 con su mensaje. Inscribirse dos veces devuelve la misma inscripción.
 */
export async function enrollInWorkshop(workshopId: string): Promise<Enrollment> {
  const payload = await request(enrollmentsEndpoint(workshopId), { method: 'POST' });
  if (!isEnrollment(payload)) {
    throw new InvalidResponseError('la inscripción');
  }
  return payload;
}

/** Talleres en los que la persona está inscrita. */
export async function fetchMyEnrollments(signal?: AbortSignal): Promise<Enrollment[]> {
  const payload = await request(MY_ENROLLMENTS_ENDPOINT, { signal });
  if (!Array.isArray(payload) || !payload.every(isEnrollment)) {
    throw new InvalidResponseError('tus inscripciones');
  }
  return payload;
}
