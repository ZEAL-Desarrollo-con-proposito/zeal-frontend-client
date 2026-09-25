import { isRecord } from '@/features/auth/model/session';
import { toIsoDate } from '@/shared/lib/dates';
import type { BadgeTone } from '@/shared/ui/Badge/Badge';

export const RESERVATION_STATUSES = ['CONFIRMADA', 'CANCELADA', 'FINALIZADA'] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/** Reserva de una sesión 1:1 en la agenda del psicólogo (contrato con el Wellbeing Service). */
export interface Reservation {
  id: string;
  employee: { id: string; fullName: string };
  startsAt: string;
  endsAt: string;
  status: ReservationStatus;
  /**
   * Ventana en la que se puede entrar a la sala. La define el servidor (regla de negocio);
   * es `null` cuando la reserva no admite ingreso (cancelada o finalizada).
   */
  joinOpensAt: string | null;
  joinClosesAt: string | null;
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isNullableIsoDateTime(value: unknown): value is string | null {
  return value === null || isIsoDateTime(value);
}

export function isReservation(value: unknown): value is Reservation {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isRecord(value.employee) &&
    typeof value.employee.id === 'string' &&
    typeof value.employee.fullName === 'string' &&
    isIsoDateTime(value.startsAt) &&
    isIsoDateTime(value.endsAt) &&
    RESERVATION_STATUSES.some((status) => status === value.status) &&
    isNullableIsoDateTime(value.joinOpensAt) &&
    isNullableIsoDateTime(value.joinClosesAt)
  );
}

export type JoinState =
  | { kind: 'open'; closesAt: Date }
  | { kind: 'upcoming'; opensAt: Date }
  | { kind: 'closed' }
  | { kind: 'unavailable' };

/** Compara la ventana que envió el servidor con el reloj; el front no decide cuándo se abre. */
export function joinState(reservation: Reservation, now: number): JoinState {
  if (reservation.joinOpensAt === null || reservation.joinClosesAt === null) {
    return { kind: 'unavailable' };
  }
  const opensAt = Date.parse(reservation.joinOpensAt);
  if (now < opensAt) {
    return { kind: 'upcoming', opensAt: new Date(opensAt) };
  }
  const closesAt = Date.parse(reservation.joinClosesAt);
  return now > closesAt ? { kind: 'closed' } : { kind: 'open', closesAt: new Date(closesAt) };
}

export function isInProgress(reservation: Reservation, now: number): boolean {
  return (
    reservation.status === 'CONFIRMADA' &&
    Date.parse(reservation.startsAt) <= now &&
    now < Date.parse(reservation.endsAt)
  );
}

/** Estado visible: "En curso" es una lectura del reloj sobre una reserva confirmada. */
export function reservationBadge(
  reservation: Reservation,
  now: number,
): { label: string; tone: BadgeTone } {
  if (isInProgress(reservation, now)) {
    return { label: 'En curso', tone: 'teal' };
  }
  const badges: Record<ReservationStatus, { label: string; tone: BadgeTone }> = {
    CONFIRMADA: { label: 'Confirmada', tone: 'sage' },
    CANCELADA: { label: 'Cancelada', tone: 'coral' },
    FINALIZADA: { label: 'Finalizada', tone: 'neutral' },
  };
  return badges[reservation.status];
}

function byStart(a: Reservation, b: Reservation): number {
  return Date.parse(a.startsAt) - Date.parse(b.startsAt);
}

export interface AgendaDay {
  key: string;
  day: Date;
  reservations: Reservation[];
}

/** Agrupa por día y ordena por hora, para la lista de la agenda. */
export function groupByDay(reservations: readonly Reservation[]): AgendaDay[] {
  const days = new Map<string, AgendaDay>();
  for (const reservation of [...reservations].sort(byStart)) {
    const start = new Date(reservation.startsAt);
    const key = toIsoDate(start);
    const group = days.get(key) ?? { key, day: start, reservations: [] };
    group.reservations.push(reservation);
    days.set(key, group);
  }
  return [...days.values()];
}

/** Próxima sesión confirmada que aún no termina. */
export function nextSession(reservations: readonly Reservation[], now: number): Reservation | null {
  return (
    [...reservations]
      .sort(byStart)
      .find(
        (reservation) =>
          reservation.status === 'CONFIRMADA' && Date.parse(reservation.endsAt) > now,
      ) ?? null
  );
}

export interface AgendaSummary {
  sessions: number;
  confirmed: number;
  cancelled: number;
}

/** Cifras de la semana visible: sesiones que siguen en pie, por atender y canceladas. */
export function summarize(reservations: readonly Reservation[]): AgendaSummary {
  const count = (status: ReservationStatus) =>
    reservations.filter((reservation) => reservation.status === status).length;
  const cancelled = count('CANCELADA');
  return { sessions: reservations.length - cancelled, confirmed: count('CONFIRMADA'), cancelled };
}
