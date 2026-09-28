import type { FreedSlotOffer } from '@/features/freedSlots/model/freedSlot';
import { FREED_SLOTS_QUEUE } from '@/features/freedSlots/model/freedSlotEvent';
import type { Slot } from '@/features/availability/model/slot';
import { isSameDay } from '@/shared/lib/dates';
import { publishToUser } from '../realtime';
import type { ReservationRecord, WellbeingDb } from './db';

/**
 * "Base de datos" de cupos liberados del simulador (HU-BE-08), en localStorage para compartirla
 * entre pestañas como con el backend real. Un cupo se ofrece a las personas con una cita
 * posterior el mismo día y lo gana quien lo tome primero.
 */
export interface FreedSlotRecord {
  id: string;
  slotId: string;
  psychologistId: string;
  startsAt: string;
  endsAt: string;
  expiresAt: string;
  /** A quiénes se les ofreció (cada uno con una cita posterior el mismo día). */
  recipientIds: string[];
  status: 'ABIERTO' | 'TOMADO';
  takenBy: string | null;
}

export interface FreedSlotsDb {
  offers: FreedSlotRecord[];
  sequence: number;
}

export const FREED_SLOTS_DB_KEY = 'zeal.mock.cupos-liberados';

/** Regla del backend: cuánto tiempo hay para tomar un cupo antes de que venza. */
export const OFFER_WINDOW_MS = 5 * 60_000;

function isFreedSlotsDb(value: unknown): value is FreedSlotsDb {
  return (
    typeof value === 'object' &&
    value !== null &&
    'offers' in value &&
    Array.isArray(value.offers) &&
    'sequence' in value &&
    typeof value.sequence === 'number'
  );
}

export function readFreedSlotsDb(): FreedSlotsDb {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(FREED_SLOTS_DB_KEY) ?? 'null');
    if (isFreedSlotsDb(stored)) {
      return stored;
    }
  } catch {
    // Datos corruptos: se empieza de cero.
  }
  return { offers: [], sequence: 0 };
}

export function writeFreedSlotsDb(db: FreedSlotsDb): void {
  localStorage.setItem(FREED_SLOTS_DB_KEY, JSON.stringify(db));
}

export function overlaps(record: ReservationRecord, start: number, end: number): boolean {
  return Date.parse(record.startsAt) < end && start < Date.parse(record.endsAt);
}

/** Quiénes reciben el cupo: citas confirmadas posteriores el mismo día, salvo quien lo liberó. */
export function recipientsOf(db: WellbeingDb, slot: Slot, releasedBy: string): string[] {
  const start = Date.parse(slot.startsAt);
  const end = Date.parse(slot.endsAt);
  const confirmed = db.reservations.filter(
    (reservation) => reservation.status === 'CONFIRMADA' && reservation.employee.id !== releasedBy,
  );
  const later = confirmed.filter(
    (reservation) =>
      Date.parse(reservation.startsAt) >= end &&
      isSameDay(new Date(reservation.startsAt), new Date(slot.startsAt)),
  );
  return [...new Set(later.map(({ employee }) => employee.id))].filter(
    (id) =>
      !confirmed.some(
        (reservation) => reservation.employee.id === id && overlaps(reservation, start, end),
      ),
  );
}

/** Lo que ve un destinatario del cupo. */
export function toOffer(
  record: FreedSlotRecord,
  psychologist: { id: string; fullName: string; title: string },
): FreedSlotOffer {
  const { id, startsAt, endsAt, expiresAt } = record;
  return {
    id,
    psychologist: {
      id: psychologist.id,
      fullName: psychologist.fullName,
      title: psychologist.title,
    },
    startsAt,
    endsAt,
    expiresAt,
  };
}

/**
 * Como el backend al cancelarse una cita: si alguien tiene una cita posterior el mismo día, se le
 * ofrece el cupo en su cola privada, en tiempo real. Devuelve la oferta, o `null` si nadie la recibe.
 */
export function openFreedSlotOffer(
  db: WellbeingDb,
  slot: Slot,
  releasedBy: string,
): FreedSlotRecord | null {
  const psychologist = db.psychologists.find(({ id }) => id === slot.psychologistId);
  const recipientIds = recipientsOf(db, slot, releasedBy);
  if (psychologist === undefined || recipientIds.length === 0) {
    return null;
  }
  const offers = readFreedSlotsDb();
  offers.sequence += 1;
  const record: FreedSlotRecord = {
    id: `cupo-${String(offers.sequence)}`,
    slotId: slot.id,
    psychologistId: slot.psychologistId,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    expiresAt: new Date(Date.now() + OFFER_WINDOW_MS).toISOString(),
    recipientIds,
    status: 'ABIERTO',
    takenBy: null,
  };
  offers.offers.push(record);
  writeFreedSlotsDb(offers);
  const offer = toOffer(record, psychologist);
  for (const userId of recipientIds) {
    publishToUser(userId, FREED_SLOTS_QUEUE, { type: 'LIBERADO', offer });
  }
  return record;
}
