import { InvalidResponseError } from '@/shared/api/errors';
import { request } from '@/shared/api/httpClient';
import type { DateRange } from '@/shared/lib/dates';
import { toIsoDate } from '@/shared/lib/dates';
import type { Reservation } from '../model/reservation';
import { isReservation } from '../model/reservation';

export const RESERVATIONS_ENDPOINT = '/api/wellbeing/reservas';
export const AGENDA_ENDPOINT = `${RESERVATIONS_ENDPOINT}/agenda`;

/** Reservas de la agenda del psicólogo autenticado entre dos fechas (inclusive). */
export async function fetchAgenda(
  { from, to }: DateRange,
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
