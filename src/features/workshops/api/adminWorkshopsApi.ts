import { InvalidResponseError } from '@/shared/api/errors';
import { request } from '@/shared/api/httpClient';
import type { Workshop } from '../model/workshop';
import { isWorkshop } from '../model/workshop';

/** Talleres de la empresa vistos por su administrador (contrato con HU-BE-15). */
export const ADMIN_WORKSHOPS_ENDPOINT = '/api/admin/talleres';

/** Lo que el formulario envía al publicar; el servidor asigna id, inscritos y versión. */
export interface NewWorkshop {
  title: string;
  description: string;
  /** Inicio del taller, en ISO 8601. */
  startsAt: string;
  durationMinutes: number;
  capacity: number;
}

export async function createWorkshop(input: NewWorkshop): Promise<Workshop> {
  const payload = await request(ADMIN_WORKSHOPS_ENDPOINT, { method: 'POST', body: input });
  if (!isWorkshop(payload)) {
    throw new InvalidResponseError('el taller publicado');
  }
  return payload;
}

/** Talleres publicados por la organización del administrador autenticado. */
export async function fetchAdminWorkshops(signal?: AbortSignal): Promise<Workshop[]> {
  const payload = await request(ADMIN_WORKSHOPS_ENDPOINT, { signal });
  if (!Array.isArray(payload) || !payload.every(isWorkshop)) {
    throw new InvalidResponseError('los talleres');
  }
  return payload;
}
