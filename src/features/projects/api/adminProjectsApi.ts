import { InvalidResponseError } from '@/shared/api/errors';
import { request } from '@/shared/api/httpClient';
import type { AdminProject } from '../model/adminProject';
import { isAdminProject } from '../model/adminProject';

/**
 * Convocatorias de la empresa vistas por su administrador. Va aparte de `/api/proyectos`, que es
 * el catálogo del empleado
 */
export const ADMIN_PROJECTS_ENDPOINT = '/api/admin/proyectos';

/** Lo que el formulario envía al publicar; el servidor asigna id, cupos ocupados y versión. */
export interface NewProject {
  title: string;
  area: string;
  cohort: string;
  summary: string;
  /** Párrafos del detalle. */
  description: string[];
  requirements: string[];
  skills: string[];
  capacity: number;
  closesAt: string;
}

export async function createProject(input: NewProject): Promise<AdminProject> {
  const payload = await request(ADMIN_PROJECTS_ENDPOINT, { method: 'POST', body: input });
  if (!isAdminProject(payload)) {
    throw new InvalidResponseError('el proyecto publicado');
  }
  return payload;
}

/** Convocatorias publicadas por la organización del administrador autenticado. */
export async function fetchAdminProjects(signal?: AbortSignal): Promise<AdminProject[]> {
  const payload = await request(ADMIN_PROJECTS_ENDPOINT, { signal });
  if (!Array.isArray(payload) || !payload.every(isAdminProject)) {
    throw new InvalidResponseError('los proyectos');
  }
  return payload;
}
