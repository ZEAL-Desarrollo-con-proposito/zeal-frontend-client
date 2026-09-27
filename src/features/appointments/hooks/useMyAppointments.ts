import { isSlotEvent, SLOTS_TOPIC } from '@/features/availability/model/slotEvent';
import { useLiveFetch } from '@/shared/realtime/useLiveFetch';
import { fetchMyAppointments } from '../api/appointmentsApi';

/**
 * Citas del empleado al día: una reserva o cancelación (también desde otra pestaña o dispositivo)
 * cambia el estado de una franja, así que la lista se vuelve a pedir; igual al recuperar conexión.
 */
export function useMyAppointments() {
  const appointments = useLiveFetch({
    key: 'mis-citas',
    load: fetchMyAppointments,
    topic: SLOTS_TOPIC,
    isRelevant: (payload) => isSlotEvent(payload) && payload.type === 'ACTUALIZADA',
  });
  return {
    status: appointments.status,
    appointments: appointments.data ?? [],
    reload: appointments.reload,
  };
}
