import { isRecord } from '@/features/auth/model/session';
import { addDays, formatDayShort, formatTime, isSameDay, startOfDay } from '@/shared/lib/dates';
import type { BadgeTone } from '@/shared/ui/Badge/Badge';

export const APPOINTMENT_STATUSES = ['CONFIRMADA', 'CANCELADA', 'FINALIZADA'] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Cita de un empleado con un psicólogo (contrato con el Wellbeing Service, HU-BE-05). */
export interface Appointment {
  id: string;
  psychologist: { id: string; fullName: string; title: string };
  startsAt: string;
  endsAt: string;
  /** Lo decide el servidor: una cita que ya terminó llega como FINALIZADA. */
  status: AppointmentStatus;
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export function isAppointment(value: unknown): value is Appointment {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isRecord(value.psychologist) &&
    typeof value.psychologist.id === 'string' &&
    typeof value.psychologist.fullName === 'string' &&
    typeof value.psychologist.title === 'string' &&
    isIsoDateTime(value.startsAt) &&
    isIsoDateTime(value.endsAt) &&
    APPOINTMENT_STATUSES.some((status) => status === value.status)
  );
}

function byStart(a: Appointment, b: Appointment): number {
  return Date.parse(a.startsAt) - Date.parse(b.startsAt);
}

export interface AppointmentGroups {
  /** Confirmadas, de la más cercana a la más lejana. */
  upcoming: Appointment[];
  /** Finalizadas, de la más reciente a la más antigua. */
  history: Appointment[];
  /** Canceladas, de la más reciente a la más antigua. */
  cancelled: Appointment[];
}

/** Pestañas de "Mis citas" (Figma B9) según el estado que envió el servidor. */
export function groupAppointments(appointments: readonly Appointment[]): AppointmentGroups {
  const withStatus = (status: AppointmentStatus) =>
    appointments.filter((appointment) => appointment.status === status);
  return {
    upcoming: withStatus('CONFIRMADA').sort(byStart),
    history: withStatus('FINALIZADA').sort((a, b) => byStart(b, a)),
    cancelled: withStatus('CANCELADA').sort((a, b) => byStart(b, a)),
  };
}

/** "Hoy · 9:00 – 9:50", "Mañana · 14:00 – 14:50" o "Lun 28 · 8:00 – 8:50". */
export function appointmentWhen(
  { startsAt, endsAt }: Pick<Appointment, 'startsAt' | 'endsAt'>,
  now: number,
): string {
  const start = new Date(startsAt);
  const today = new Date(now);
  let day = formatDayShort(start);
  if (isSameDay(start, today)) {
    day = 'Hoy';
  } else if (isSameDay(start, addDays(today, 1))) {
    day = 'Mañana';
  }
  return `${day} · ${formatTime(start)} – ${formatTime(new Date(endsAt))}`;
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Cuánto falta para una cita (Figma B9, "EN 2 HORAS"). */
export function timeUntil({ startsAt, endsAt }: Appointment, now: number): string {
  const start = Date.parse(startsAt);
  if (start <= now) {
    return now < Date.parse(endsAt) ? 'En curso' : 'Terminó';
  }
  const minutes = Math.ceil((start - now) / MINUTE);
  if (minutes < 60) {
    return `En ${String(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? 'En 1 hora' : `En ${String(hours)} horas`;
  }
  const days = Math.round(
    (startOfDay(new Date(start)).getTime() - startOfDay(new Date(now)).getTime()) / DAY,
  );
  return days === 1 ? 'Mañana' : `En ${String(days)} días`;
}

const STATUS_BADGE: Record<AppointmentStatus, { label: string; tone: BadgeTone }> = {
  CONFIRMADA: { label: 'Confirmada', tone: 'sage' },
  FINALIZADA: { label: 'Finalizada', tone: 'neutral' },
  CANCELADA: { label: 'Cancelada', tone: 'coral' },
};

export function appointmentBadge({ status }: Appointment): { label: string; tone: BadgeTone } {
  return STATUS_BADGE[status];
}
