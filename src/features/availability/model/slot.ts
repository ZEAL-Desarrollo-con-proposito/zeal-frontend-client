import { isRecord } from '@/features/auth/model/session';
import { formatLongDate, formatTime } from '@/shared/lib/dates';

export const SLOT_STATUSES = ['DISPONIBLE', 'RESERVADA'] as const;

export type SlotStatus = (typeof SLOT_STATUSES)[number];

export const SLOT_STATUS_LABEL: Record<SlotStatus, string> = {
  DISPONIBLE: 'Abierta',
  RESERVADA: 'Reservada',
};

/** Franja horaria del psicólogo (contrato con el Wellbeing Service, ver README). */
export interface Slot {
  id: string;
  psychologistId: string;
  /** Inicio y fin en ISO 8601 con zona horaria. */
  startsAt: string;
  endsAt: string;
  status: SlotStatus;
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

export function isSlot(value: unknown): value is Slot {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.psychologistId) &&
    isIsoDateTime(value.startsAt) &&
    isIsoDateTime(value.endsAt) &&
    SLOT_STATUSES.some((status) => status === value.status)
  );
}

/** "miércoles, 23 de septiembre de 10:00 a 10:50": para avisos y etiquetas accesibles. */
export function describeSlot(slot: Pick<Slot, 'startsAt' | 'endsAt'>): string {
  const start = new Date(slot.startsAt);
  const end = new Date(slot.endsAt);
  return `${formatLongDate(start).toLowerCase()} de ${formatTime(start)} a ${formatTime(end)}`;
}

export function compareByStart(a: Slot, b: Slot): number {
  return Date.parse(a.startsAt) - Date.parse(b.startsAt);
}
