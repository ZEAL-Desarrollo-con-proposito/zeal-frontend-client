import type { Appointment } from '@/features/appointments/model/appointment';
import { isAppointment } from '@/features/appointments/model/appointment';
import { InvalidResponseError } from '@/shared/api/errors';
import { request } from '@/shared/api/httpClient';
import type { FreedSlotOffer } from '../model/freedSlot';
import { isFreedSlotOffer } from '../model/freedSlot';

export const FREED_SLOTS_ENDPOINT = '/api/wellbeing/cupos';

export function claimEndpoint(offerId: string): string {
  return `${FREED_SLOTS_ENDPOINT}/${encodeURIComponent(offerId)}/tomar`;
}

/**
 * Cupos que la persona todavía puede tomar (sin vencer ni tomados). Sirve para recuperar los que
 * se ofrecieron mientras no estaba conectada.
 */
export async function fetchOpenOffers(signal?: AbortSignal): Promise<FreedSlotOffer[]> {
  const payload = await request(FREED_SLOTS_ENDPOINT, { signal });
  if (!Array.isArray(payload) || !payload.every(isFreedSlotOffer)) {
    throw new InvalidResponseError('los cupos liberados');
  }
  return payload;
}

/**
 * Intenta tomar un cupo liberado. El servidor decide quién gana: solo la primera petición que
 * llega recibe la cita (200); las demás reciben 409 porque otra persona lo tomó primero.
 */
export async function claimFreedSlot(offerId: string): Promise<Appointment> {
  const payload = await request(claimEndpoint(offerId), { method: 'POST' });
  if (!isAppointment(payload)) {
    throw new InvalidResponseError('el cupo tomado');
  }
  return payload;
}
