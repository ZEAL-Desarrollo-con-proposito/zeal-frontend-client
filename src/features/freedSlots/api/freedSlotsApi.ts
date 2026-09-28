import type { Appointment } from '@/features/appointments/model/appointment';
import { isAppointment } from '@/features/appointments/model/appointment';
import { InvalidResponseError } from '@/shared/api/errors';
import { request } from '@/shared/api/httpClient';

export const FREED_SLOTS_ENDPOINT = '/api/wellbeing/cupos';

export function claimEndpoint(offerId: string): string {
  return `${FREED_SLOTS_ENDPOINT}/${encodeURIComponent(offerId)}/tomar`;
}

/**Cuando se intenta tomar un cupo liberado, el servidor decide quien gana y la primera que llega recibe la cita */
export async function claimFreedSlot(offerId: string): Promise<Appointment> {
  const payload = await request(claimEndpoint(offerId), { method: 'POST' });
  if (!isAppointment(payload)) {
    throw new InvalidResponseError('el cupo tomado');
  }
  return payload;
}
