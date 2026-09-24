import { InvalidResponseError } from '@/shared/api/errors';
import { request } from '@/shared/api/httpClient';
import { toIsoDate } from '@/shared/lib/dates';
import type { Slot } from '../model/slot';
import { isSlot } from '../model/slot';

export const SLOTS_ENDPOINT = '/api/wellbeing/franjas';
export const MY_SLOTS_ENDPOINT = `${SLOTS_ENDPOINT}/mias`;

export interface DateRange {
  from: Date;
  to: Date;
}

/** Franjas del psicólogo autenticado entre dos fechas (inclusive). */
export async function fetchMySlots({ from, to }: DateRange, signal?: AbortSignal): Promise<Slot[]> {
  const payload = await request(MY_SLOTS_ENDPOINT, {
    query: { desde: toIsoDate(from), hasta: toIsoDate(to) },
    signal,
  });
  if (!Array.isArray(payload) || !payload.every(isSlot)) {
    throw new InvalidResponseError('las franjas');
  }
  return payload;
}
