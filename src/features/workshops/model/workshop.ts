import { isRecord } from '@/features/auth/model/session';
import { addDays, formatDayShort, formatTime, isIsoDateTime, isSameDay } from '@/shared/lib/dates';
import type { Spots } from '@/shared/spots/spots';
import { availableSpots, isSpots } from '@/shared/spots/spots';
import type { BadgeTone } from '@/shared/ui/Badge/Badge';

/** Taller comunitario con capacidad máxima, como lo ve un empleado (contrato con HU-BE-18). */
export interface Workshop extends Spots {
  id: string;
  title: string;
  summary: string;
  /** Quién lo dirige, p. ej. "Gabriela Muñoz". */
  facilitator: string;
  startsAt: string;
  endsAt: string;
}

/** Lo que se necesita para ubicar un taller en el tiempo (también lo trae cada inscripción). */
interface Schedule {
  startsAt: string;
  endsAt: string;
}

export function isWorkshop(value: unknown): value is Workshop {
  return (
    isSpots(value) &&
    value.capacity > 0 &&
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.summary === 'string' &&
    typeof value.facilitator === 'string' &&
    isIsoDateTime(value.startsAt) &&
    isIsoDateTime(value.endsAt)
  );
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

/** "Hoy · 16:00", "Mañana · 9:00" o "Jue 24 · 12:30". */
export function workshopWhen(startsAt: string, now: number): string {
  const start = new Date(startsAt);
  const today = new Date(now);
  let day = formatDayShort(start);
  if (isSameDay(start, today)) {
    day = 'Hoy';
  } else if (isSameDay(start, addDays(today, 1))) {
    day = 'Mañana';
  }
  return `${day} · ${formatTime(start)}`;
}

/** "50 min". */
export function workshopDuration({ startsAt, endsAt }: Schedule): string {
  return `${String(Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / 60_000))} min`;
}

/** Ya empezó: el servidor ya no recibe inscripciones y el cliente lo refleja. */
export function hasStarted({ startsAt }: Pick<Schedule, 'startsAt'>, now: number): boolean {
  return Date.parse(startsAt) <= now;
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

/** Del más próximo al más lejano. */
export function bySoonest(a: Pick<Schedule, 'startsAt'>, b: Pick<Schedule, 'startsAt'>): number {
  return Date.parse(a.startsAt) - Date.parse(b.startsAt);
}
