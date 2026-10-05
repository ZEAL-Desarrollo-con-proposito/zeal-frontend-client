import { InvalidResponseError } from '@/shared/api/errors';
import { request } from '@/shared/api/httpClient';
import type { Application } from '../model/application';
import { isApplication } from '../model/application';
import type { Project, ProjectDetail } from '../model/project';
import { isProject, isProjectDetail } from '../model/project';

export const PROJECTS_ENDPOINT = '/api/proyectos';

/** Convocatorias abiertas para el empleado, con sus cupos actuales (HU-BE-16). */
export async function fetchProjects(signal?: AbortSignal): Promise<Project[]> {
  const payload = await request(PROJECTS_ENDPOINT, { signal });
  if (!Array.isArray(payload) || !payload.every(isProject)) {
    throw new InvalidResponseError('las convocatorias');
  }
  return payload;
}

/** Detalle de una convocatoria. */
export async function fetchProject(id: string, signal?: AbortSignal): Promise<ProjectDetail> {
  const payload = await request(`${PROJECTS_ENDPOINT}/${encodeURIComponent(id)}`, { signal });
  if (!isProjectDetail(payload)) {
    throw new InvalidResponseError('la convocatoria');
  }
  return payload;
}

export const MY_APPLICATIONS_ENDPOINT = '/api/postulaciones/mias';

/** Ruta para postularse a una convocatoria. */
export function applicationsEndpoint(projectId: string): string {
  return `${PROJECTS_ENDPOINT}/${encodeURIComponent(projectId)}/postulaciones`;
}

function toApplication(payload: unknown): Application {
  if (!isApplication(payload)) {
    throw new InvalidResponseError('la postulación');
  }
  return payload;
}

/**
 * Se postula a una convocatoria. El servidor decide de forma atómica si hay cupo (aceptada) o
 * no (lista de espera); postularse dos veces devuelve la misma postulación.
 */
export async function applyToProject(projectId: string): Promise<Application> {
  return toApplication(await request(applicationsEndpoint(projectId), { method: 'POST' }));
}

/** Postulaciones de la persona, las más recientes primero. */
export async function fetchMyApplications(signal?: AbortSignal): Promise<Application[]> {
  const payload = await request(MY_APPLICATIONS_ENDPOINT, { signal });
  if (!Array.isArray(payload) || !payload.every(isApplication)) {
    throw new InvalidResponseError('tus postulaciones');
  }
  return payload;
}
