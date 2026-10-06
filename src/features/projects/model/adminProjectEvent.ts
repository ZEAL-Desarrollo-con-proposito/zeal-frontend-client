import { isRecord } from '@/features/auth/model/session';
import type { AdminProject } from './adminProject';
import { isAdminProject } from './adminProject';

/**
 * Cola privada de cada administrador en el Real-Time: el servidor solo entrega aquí los
 * proyectos de su organización .Los cupos que cambian no viajan por aquí: tienen su propio canal por convocatoria.
 */
export const PROJECTS_QUEUE = '/user/queue/proyectos';

/** Se publicó una convocatoria nueva, desde esta sesión o desde otra de la empresa. */
export interface ProjectPublishedEvent {
  type: 'PUBLICADO';
  project: AdminProject;
}

export function isProjectPublishedEvent(value: unknown): value is ProjectPublishedEvent {
  return isRecord(value) && value.type === 'PUBLICADO' && isAdminProject(value.project);
}
