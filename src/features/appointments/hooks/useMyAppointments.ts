import { useState } from 'react';
import { isSlotEvent, SLOTS_TOPIC } from '@/features/availability/model/slotEvent';
import { useLiveFetch } from '@/shared/realtime/useLiveFetch';
import { fetchMyAppointments } from '../api/appointmentsApi';
import type { Appointment } from '../model/appointment';

/** Cambio local todavía no confirmado por un refetch: a qué tanda de datos aplica. */
interface LocalPatch {
  forData: Appointment[] | null;
  appointment: Appointment;
}

/**
 * Citas del empleado al día: una reserva o cancelación (también desde otra pestaña o dispositivo)
 * cambia el estado de una franja, así que la lista se vuelve a pedir; igual al recuperar conexión.
 *
 * tambien dispara un refetch pero de fondo refleja el resultado que ya devolvio el servidor al instante sin
 * esperar el viaje de ida y vuelta
 */
export function useMyAppointments() {
  const resource = useLiveFetch({
    key: 'mis-citas',
    load: fetchMyAppointments,
    topic: SLOTS_TOPIC,
    isRelevant: (payload) => isSlotEvent(payload) && payload.type === 'ACTUALIZADA',
  });
  const [patch, setPatch] = useState<LocalPatch | null>(null);

  const loaded = resource.data ?? [];
  const appointments =
    patch !== null && patch.forData === resource.data
      ? loaded.map((appointment) =>
          appointment.id === patch.appointment.id ? patch.appointment : appointment,
        )
      : loaded;

  /** Aplica al instante una cita cancelada que ya confirmó el servidor. */
  function applyCancellation(cancelled: Appointment) {
    setPatch({ forData: resource.data, appointment: cancelled });
  }

  return {
    status: resource.status,
    appointments,
    reload: resource.reload,
    applyCancellation,
  };
}
