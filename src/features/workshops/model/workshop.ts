import { isRecord } from '@/features/auth/model/session';
import type { Spots } from '@/features/projects/model/project';
import { isSpots } from '@/features/projects/model/project';
import { formatLongDate, formatTime } from '@/shared/lib/dates';

/**
 * Taller comunitario en vivo con capacidad máxima, como lo ve el administrador de la empresa
 * (contrato con HU-BE-15). Las personas inscritas ocupan cupos: `occupied` nunca supera `capacity`.
 */
export interface Workshop extends Spots {
  id: string;
  title: string;
  description: string;
  /** Inicio del taller, en ISO 8601. */
  startsAt: string;
  durationMinutes: number;
  publishedAt: string;
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export function isWorkshop(value: unknown): value is Workshop {
  return (
    isSpots(value) &&
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    isIsoDateTime(value.startsAt) &&
    typeof value.durationMinutes === 'number' &&
    Number.isInteger(value.durationMinutes) &&
    value.durationMinutes > 0 &&
    isIsoDateTime(value.publishedAt)
  );
}

/** Más reciente primero; a igual instante, el id mayor. */
export function compareByNewest(a: Workshop, b: Workshop): number {
  return (
    Date.parse(b.publishedAt) - Date.parse(a.publishedAt) ||
    b.id.localeCompare(a.id, 'es', { numeric: true })
  );
}

/** El taller ya empezó: deja de aceptar inscripciones. */
export function hasStarted(workshop: Pick<Workshop, 'startsAt'>, now: number): boolean {
  return Date.parse(workshop.startsAt) <= now;
}

/** "Martes, 6 de octubre · 15:00 – 16:30". */
export function describeSchedule(workshop: Pick<Workshop, 'startsAt' | 'durationMinutes'>): string {
  const start = new Date(workshop.startsAt);
  const end = new Date(start.getTime() + workshop.durationMinutes * 60_000);
  return `${formatLongDate(start)} · ${formatTime(start)} – ${formatTime(end)}`;
}

/** "Capacidad para 30 personas" o "Capacidad para 1 persona". */
export function capacityLabel(capacity: number): string {
  return capacity === 1
    ? 'Capacidad para 1 persona'
    : `Capacidad para ${String(capacity)} personas`;
}
