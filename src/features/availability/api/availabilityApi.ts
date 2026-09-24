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

export interface NewSlot {
  startsAt: string;
  endsAt: string;
}

/** Abre una franja. El servidor valida solapes, horarios pasados y permisos. */
export async function createSlot(input: NewSlot): Promise<Slot> {
  const payload = await request(SLOTS_ENDPOINT, { method: 'POST', body: input });
  if (!isSlot(payload)) {
    throw new InvalidResponseError('la franja creada');
  }
  return payload;
}

/** Elimina una franja abierta. El servidor rechaza (409) las que ya están reservadas. */
export async function deleteSlot(id: string): Promise<void> {
  await request(`${SLOTS_ENDPOINT}/${encodeURIComponent(id)}`, { method: 'DELETE' });
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
