import type { Slot } from '@/features/availability/model/slot';
import { isSlot } from '@/features/availability/model/slot';
import { InvalidResponseError } from '@/shared/api/errors';
import { request } from '@/shared/api/httpClient';
import type { DateRange } from '@/shared/lib/dates';
import { toIsoDate } from '@/shared/lib/dates';
import type { Psychologist } from '../model/psychologist';
import { isPsychologist } from '../model/psychologist';

export const PSYCHOLOGISTS_ENDPOINT = '/api/wellbeing/psicologos';

function psychologistEndpoint(id: string): string {
  return `${PSYCHOLOGISTS_ENDPOINT}/${encodeURIComponent(id)}`;
}

/** Directorio de psicólogos con su próximo bloque libre (HU-04). */
export async function fetchDirectory(signal?: AbortSignal): Promise<Psychologist[]> {
  const payload = await request(PSYCHOLOGISTS_ENDPOINT, { signal });
  if (!Array.isArray(payload) || !payload.every(isPsychologist)) {
    throw new InvalidResponseError('el directorio');
  }
  return payload;
}

export async function fetchPsychologist(id: string, signal?: AbortSignal): Promise<Psychologist> {
  const payload = await request(psychologistEndpoint(id), { signal });
  if (!isPsychologist(payload)) {
    throw new InvalidResponseError('el psicólogo');
  }
  return payload;
}

/** Bloques que un empleado puede reservar con el psicólogo entre dos fechas (inclusive). */
export async function fetchFreeSlots(
  id: string,
  { from, to }: DateRange,
  signal?: AbortSignal,
): Promise<Slot[]> {
  const payload = await request(`${psychologistEndpoint(id)}/franjas`, {
    query: { desde: toIsoDate(from), hasta: toIsoDate(to) },
    signal,
  });
  if (!Array.isArray(payload) || !payload.every(isSlot)) {
    throw new InvalidResponseError('los bloques libres');
  }
  return payload;
}
