import { isRecord } from '@/features/auth/model/session';
import type { ProjectDetail } from './project';
import { isProjectDetail } from './project';

/**
 * Canal público de la organización en el Real-Time Gateway: avisa a todos sus empleados (y
 * admins) cuando se publica una convocatoria nueva, sin tener que recargar el catálogo.
 */
export function organizationProjectsTopic(organization: string): string {
  return `/topic/organizaciones/${encodeURIComponent(organization)}/proyectos`;
}

/** `PUBLICADO`: se publicó una convocatoria nueva en la organización. */
export interface ProjectPublishedEvent {
  type: 'PUBLICADO';
  /** Proyecto ya con su detalle largo (el empleado lo necesita si abre el detalle al instante). */
  project: ProjectDetail;
}

export function isProjectPublishedEvent(value: unknown): value is ProjectPublishedEvent {
  return isRecord(value) && value.type === 'PUBLICADO' && isProjectDetail(value.project);
}
