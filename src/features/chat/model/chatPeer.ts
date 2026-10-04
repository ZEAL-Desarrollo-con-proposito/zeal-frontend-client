import type { Appointment } from '@/features/appointments/model/appointment';
import type { Reservation } from '@/features/agenda/model/reservation';

/** La otra persona de la conversación: un psicólogo (con `title`) o un empleado (sin él). */
export interface ChatPeer {
  id: string;
  fullName: string;
  title?: string;
}

/** Margen para considerar "en curso" una cita que acaba de empezar. */
const RECENT_WINDOW_MS = 60 * 60 * 1000;

/** El más cercano a `now`: primero entre los que empiezan dentro del margen; si no hay, el más próximo en el tiempo. */
function pickClosest<T>(items: readonly T[], getStart: (item: T) => number, now: number): T | null {
  const relevant = items.filter((item) => getStart(item) >= now - RECENT_WINDOW_MS);
  const pool = relevant.length > 0 ? relevant : items;
  return (
    [...pool].sort((a, b) => {
      const da = Math.abs(getStart(a) - now);
      const db = Math.abs(getStart(b) - now);
      return da - db;
    })[0] ?? null
  );
}

/**
 * Psicólogo de la conversación del empleado: el de la cita más próxima (futura más cercana; si no
 * hay, la más reciente). Sin citas, no hay con quién hablar.
 */
export function psychologistPeer(
  appointments: readonly Appointment[],
  now: number,
): ChatPeer | null {
  const appointment = pickClosest(appointments, (item) => Date.parse(item.startsAt), now);
  if (appointment === null) {
    return null;
  }
  const { id, fullName, title } = appointment.psychologist;
  return { id, fullName, title };
}

/**
 * Empleado de la conversación del psicólogo: el de la reserva más próxima (futura más cercana; si
 * no hay, la más reciente). Sin reservas, no hay con quién hablar.
 */
export function employeePeer(reservations: readonly Reservation[], now: number): ChatPeer | null {
  const reservation = pickClosest(reservations, (item) => Date.parse(item.startsAt), now);
  if (reservation === null) {
    return null;
  }
  const { id, fullName } = reservation.employee;
  return { id, fullName };
}
