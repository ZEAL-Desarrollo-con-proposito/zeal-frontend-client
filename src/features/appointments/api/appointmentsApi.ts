import { RESERVATIONS_ENDPOINT } from '@/features/agenda/api/agendaApi';
import { InvalidResponseError } from '@/shared/api/errors';
import { request } from '@/shared/api/httpClient';
import type { Appointment } from '../model/appointment';
import { isAppointment } from '../model/appointment';

export const MY_APPOINTMENTS_ENDPOINT = `${RESERVATIONS_ENDPOINT}/mias`;

/** Citas del empleado autenticado, por fecha de inicio. El estado lo decide el servidor. */
export async function fetchMyAppointments(signal?: AbortSignal): Promise<Appointment[]> {
  const payload = await request(MY_APPOINTMENTS_ENDPOINT, { signal });
  if (!Array.isArray(payload) || !payload.every(isAppointment)) {
    throw new InvalidResponseError('tus citas');
  }
  return payload;
}

/** Cancela una cita. El servidor decide si aun esta dentro del palozo de 24 horas si no da un error 409 libera esta cita*/
export async function cancelAppointment(id: string): Promise<Appointment> {
  const payload = await request(`${RESERVATIONS_ENDPOINT}/${encodeURIComponent(id)}/cancelar`, {
    method: 'POST',
  });
  if (!isAppointment(payload)) {
    throw new InvalidResponseError('cita cancelada');
  }
  return payload;
}