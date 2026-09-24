import { isRecord } from '@/features/auth/model/session';

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

export function compareByStart(a: Slot, b: Slot): number {
  return Date.parse(a.startsAt) - Date.parse(b.startsAt);
}
