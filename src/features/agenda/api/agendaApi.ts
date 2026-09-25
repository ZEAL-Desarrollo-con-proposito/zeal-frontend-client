import { InvalidResponseError } from '@/shared/api/errors';
import { request } from '@/shared/api/httpClient';
import { toIsoDate } from '@/shared/lib/dates';
import type { Reservation } from '../model/reservation';
import { isReservation } from '../model/reservation';

export const RESERVATIONS_ENDPOINT = '/api/wellbeing/reservas';
export const AGENDA_ENDPOINT = `${RESERVATIONS_ENDPOINT}/agenda`;

/** Reservas de la agenda del psicólogo autenticado entre dos fechas (inclusive). */
export async function fetchAgenda(
  { from, to }: { from: Date; to: Date },
  signal?: AbortSignal,
): Promise<Reservation[]> {
  const payload = await request(AGENDA_ENDPOINT, {
    query: { desde: toIsoDate(from), hasta: toIsoDate(to) },
    signal,
  });
  if (!Array.isArray(payload) || !payload.every(isReservation)) {
    throw new InvalidResponseError('la agenda');
  }
  return payload;
}

/** Una reserva de la agenda (p. ej. para abrir su sala). */
export async function fetchReservation(id: string, signal?: AbortSignal): Promise<Reservation> {
  const payload = await request(`${RESERVATIONS_ENDPOINT}/${encodeURIComponent(id)}`, { signal });
  if (!isReservation(payload)) {
    throw new InvalidResponseError('la reserva');
  }
  return payload;
}
