import { isRecord } from '@/features/auth/model/session';
import {
  addDays,
  formatDayShort,
  formatLongDate,
  formatTime,
  isIsoDateTime,
  isSameDay,
} from '@/shared/lib/dates';
import type { Spots } from '@/shared/spots/spots';
import { availableSpots, isSpots } from '@/shared/spots/spots';
import type { BadgeTone } from '@/shared/ui/Badge/Badge';

/**
 * Taller comunitario en vivo con capacidad máxima, como lo publica el administrador de la empresa
 * (contrato con HU-BE-15) y lo ven sus empleados (HU-BE-18). Las personas inscritas ocupan cupos:
 * `occupied` nunca supera `capacity`.
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

/** Lo que se necesita para ubicar un taller en el tiempo (también lo trae cada inscripción). */
type Schedule = Pick<Workshop, 'startsAt' | 'durationMinutes'>;

export function isWorkshop(value: unknown): value is Workshop {
  return (
    isSpots(value) &&
    value.capacity > 0 &&
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

/** Del más próximo al más lejano. */
export function bySoonest(a: Pick<Schedule, 'startsAt'>, b: Pick<Schedule, 'startsAt'>): number {
  return Date.parse(a.startsAt) - Date.parse(b.startsAt);
}

/** El taller ya empezó: deja de aceptar inscripciones. */
export function hasStarted(workshop: Pick<Workshop, 'startsAt'>, now: number): boolean {
  return Date.parse(workshop.startsAt) <= now;
}

/** "Martes, 6 de octubre · 15:00 – 16:30". */
export function describeSchedule(workshop: Schedule): string {
  const start = new Date(workshop.startsAt);
  const end = new Date(start.getTime() + workshop.durationMinutes * 60_000);
  return `${formatLongDate(start)} · ${formatTime(start)} – ${formatTime(end)}`;
}

/** "Hoy · 16:00 · 50 min", "Mañana · 9:00 · 60 min" o "Jue 24 · 12:30 · 90 min" (Figma B6). */
export function workshopWhen({ startsAt, durationMinutes }: Schedule, now: number): string {
  const start = new Date(startsAt);
  const today = new Date(now);
  let day = formatDayShort(start);
  if (isSameDay(start, today)) {
    day = 'Hoy';
  } else if (isSameDay(start, addDays(today, 1))) {
    day = 'Mañana';
  }
  return `${day} · ${formatTime(start)} · ${String(durationMinutes)} min`;
}

/** Chip de inicio: "Empieza en 45 min" (coral) si falta menos de una hora, "En curso" si ya empezó. */
export function startBadge(
  { startsAt }: Pick<Schedule, 'startsAt'>,
  now: number,
): { label: string; tone: BadgeTone } | null {
  const minutes = Math.ceil((Date.parse(startsAt) - now) / 60_000);
  if (minutes <= 0) {
    return { label: 'En curso', tone: 'sage' };
  }
  return minutes < 60 ? { label: `Empieza en ${String(minutes)} min`, tone: 'coral' } : null;
}

/** "Capacidad para 30 personas" o "Capacidad para 1 persona". */
export function capacityLabel(capacity: number): string {
  return capacity === 1
    ? 'Capacidad para 1 persona'
    : `Capacidad para ${String(capacity)} personas`;
}

export interface Availability {
  label: string;
  tone: BadgeTone;
  full: boolean;
}

/** Quedan el 15 % de los cupos o menos: se avisa que son los últimos (Figma B6). */
const LAST_SPOTS_RATIO = 0.15;

/** "Con cupo", "Últimos cupos" o "Cupos agotados", según lo que informó el servidor. */
export function availabilityOf(spots: Spots): Availability {
  const available = availableSpots(spots);
  if (available === 0) {
    return { label: 'Cupos agotados', tone: 'coral', full: true };
  }
  return available <= spots.capacity * LAST_SPOTS_RATIO
    ? { label: 'Últimos cupos', tone: 'mauve', full: false }
    : { label: 'Con cupo', tone: 'sage', full: false };
}

/** "29 / 30 cupos" (Figma B6). */
export function spotsCount({ occupied, capacity }: Spots): string {
  return `${String(Math.min(occupied, capacity))} / ${String(capacity)} cupos`;
}

/** Ocupación en porcentaje entero: 97. */
export function occupancy({ occupied, capacity }: Spots): number {
  return Math.min(Math.round((occupied / capacity) * 100), 100);
}
