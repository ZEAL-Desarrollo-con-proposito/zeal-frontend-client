import type { Slot } from '@/features/availability/model/slot';
import { readWellbeingDb, writeWellbeingDb } from '@/mocks/wellbeing/db';

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
