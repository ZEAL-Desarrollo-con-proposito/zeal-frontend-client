import { InvalidResponseError } from '@/shared/api/errors';
import { request } from '@/shared/api/httpClient';
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
