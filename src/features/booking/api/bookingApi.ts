import { RESERVATIONS_ENDPOINT } from '@/features/agenda/api/agendaApi';
import type { Appointment } from '@/features/appointments/model/appointment';
import { isAppointment } from '@/features/appointments/model/appointment';
import { InvalidResponseError } from '@/shared/api/errors';
import { request } from '@/shared/api/httpClient';

/**
 * Agenda una cita en un bloque. La reserva es atómica en el servidor: si otra persona tomó el
 * bloque primero responde 409 y el bloque no se asigna dos veces.
 */
export async function bookSlot(slotId: string): Promise<Appointment> {
  const payload = await request(RESERVATIONS_ENDPOINT, { method: 'POST', body: { slotId } });
  if (!isAppointment(payload)) {
    throw new InvalidResponseError('la cita agendada');
  }
  return payload;
}
