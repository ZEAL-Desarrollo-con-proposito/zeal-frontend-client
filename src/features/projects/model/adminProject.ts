import { isRecord } from '@/features/auth/model/session';
import { formatLongDate } from '@/shared/lib/dates';
import type { BadgeTone } from '@/shared/ui/Badge/Badge';
import type { Project } from './project';
import { availableSpots } from '@/shared/spots/spots';
import { closingOf, isProject } from './project';

/**Convocatoria vista por el administrador de la empresa (HU-FE-14)*/
export interface AdminProject extends Project {
  publishedAt: string;
}

export function isAdminProject(value: unknown): value is AdminProject {
  return (
    isProject(value) &&
    isRecord(value) &&
    typeof value.publishedAt === 'string' &&
    !Number.isNaN(Date.parse(value.publishedAt))
  );
}

/** Más reciente primero; a igual instante, el id mayor  */
export function compareByNewest(a: AdminProject, b: AdminProject): number {
  return (
    Date.parse(b.publishedAt) - Date.parse(a.publishedAt) ||
    b.id.localeCompare(a.id, 'es', { numeric: true })
  );
}

/** Estado de la convocatoria: vencida, sin cupos o abierta. */
export function projectBadge(
  project: Pick<Project, 'capacity' | 'occupied' | 'version' | 'closesAt'>,
  now: number,
): { label: string; tone: BadgeTone } {
  if (closingOf(project.closesAt, now).closed) {
    return { label: 'Cerrada', tone: 'neutral' };
  }
  return availableSpots(project) === 0
    ? { label: 'Sin cupos', tone: 'coral' }
    : { label: 'Abierta', tone: 'sage' };
}

export function describeDay(iso: string): string {
  return formatLongDate(new Date(iso)).toLowerCase();
}
