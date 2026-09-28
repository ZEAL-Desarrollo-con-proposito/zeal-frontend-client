import type { Slot } from '@/features/availability/model/slot';
import type { ReservationRecord } from '@/mocks/wellbeing/db';
import {
  nextId,
  readWellbeingDb,
  SEED_PSYCHOLOGIST_ID,
  writeWellbeingDb,
} from '@/mocks/wellbeing/db';

/**
 * Cancela en el servidor simulado la reserva que empieza a esa hora, como lo haría el paciente
 * desde su cuenta, y devuelve la franja liberada (la del evento en tiempo real).
 */
export function cancelReservationAt(start: Date): Slot {
  const db = readWellbeingDb();
  const reservation = db.reservations.find(
    (candidate) => candidate.startsAt === start.toISOString(),
  );
  const slot = db.slots.find((candidate) => candidate.id === reservation?.slotId);
  if (reservation === undefined || slot === undefined) {
    throw new Error('Reserva semilla no encontrada');
  }
  reservation.status = 'CANCELADA';
  slot.status = 'DISPONIBLE';
  writeWellbeingDb(db);
  return slot;
}

export const MARIANA = 'usr-empleado-002';

/**
 * Prepara una competencia por un cupo liberado (HU-FE-08): el viernes 25, Mariana tiene cita con
 * Laura a las 8:00 (cancelable: faltan más de 24 h) y David una posterior a las 14:00, así que
 * David recibe el cupo cuando Mariana cancela. Devuelve la reserva de Mariana.
 */
export function arrangeFreedSlotCompetition(): ReservationRecord {
  const db = readWellbeingDb();
  const book = (hour: number, employee: { id: string; fullName: string }): ReservationRecord => {
    const start = new Date(2026, 8, 25, hour).toISOString();
    const slot = db.slots.find(
      (candidate) =>
        candidate.psychologistId === SEED_PSYCHOLOGIST_ID && candidate.startsAt === start,
    );
    if (slot === undefined) {
      throw new Error('Franja semilla no encontrada');
    }
    db.reservations = db.reservations.filter(({ slotId }) => slotId !== slot.id);
    slot.status = 'RESERVADA';
    const record: ReservationRecord = {
      id: nextId(db, 'reserva'),
      slotId: slot.id,
      psychologistId: slot.psychologistId,
      employee,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      status: 'CONFIRMADA',
    };
    db.reservations.push(record);
    return record;
  };
  const marianas = book(8, { id: MARIANA, fullName: 'Mariana Torres' });
  book(14, { id: 'usr-empleado-001', fullName: 'David Cajamarca' });
  writeWellbeingDb(db);
  return marianas;
}
