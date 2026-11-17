import { closingOf } from '@/features/projects/model/project';
import type { Project } from '@/features/projects/model/project';
import { hasStarted } from '@/features/workshops/model/workshop';
import type { Workshop } from '@/features/workshops/model/workshop';
import type { Spots } from '@/shared/spots/spots';
import { availableSpots } from '@/shared/spots/spots';

/** Cupos de un conjunto de convocatorias o talleres: lo ocupado, lo ofrecido y el porcentaje. */
export interface SpotsTotals {
  occupied: number;
  capacity: number;
  /** Porcentaje entero de cupos ocupados (0 si no se ofreció ninguno). */
  percent: number;
}

/** Totales de las convocatorias de la empresa: nunca de una persona. */
export interface ProjectsReport {
  published: number;
  open: number;
  closed: number;
  /** Abiertas que ya no tienen cupos. */
  full: number;
  spots: SpotsTotals;
}

/** Totales de los talleres de la empresa: nunca de una persona. */
export interface WorkshopsReport {
  published: number;
  upcoming: number;
  held: number;
  spots: SpotsTotals;
}

export function spotsTotals(items: readonly Spots[]): SpotsTotals {
  const occupied = items.reduce((sum, item) => sum + item.occupied, 0);
  const capacity = items.reduce((sum, item) => sum + item.capacity, 0);
  return {
    occupied,
    capacity,
    percent: capacity === 0 ? 0 : Math.round((occupied / capacity) * 100),
  };
}

export function summarizeProjects(projects: readonly Project[], now: number): ProjectsReport {
  const open = projects.filter((project) => !closingOf(project.closesAt, now).closed);
  return {
    published: projects.length,
    open: open.length,
    closed: projects.length - open.length,
    full: open.filter((project) => availableSpots(project) === 0).length,
    spots: spotsTotals(projects),
  };
}

export function summarizeWorkshops(workshops: readonly Workshop[], now: number): WorkshopsReport {
  const held = workshops.filter((workshop) => hasStarted(workshop, now));
  return {
    published: workshops.length,
    upcoming: workshops.length - held.length,
    held: held.length,
    spots: spotsTotals(workshops),
  };
}

export function percentLabel(percent: number): string {
  return `${String(percent)} %`;
}
