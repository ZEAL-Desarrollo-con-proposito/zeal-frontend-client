import { useState } from 'react';
import { describeMutationError } from '@/shared/api/describeError';
import { ApiError } from '@/shared/api/errors';
import { cancelAppointment } from '../api/appointmentsApi';
import type { Appointment } from '../model/appointment';

interface CancelAppointmentHandlers {
  onCancelled: (appointment: Appointment) => void;
}

/** si la cita ya no existe (404) se da por cancelada y es idempotente frenta a otras sesiones
 */
export function useCancelAppointment({ onCancelled }: CancelAppointmentHandlers) {
  const [target, setTarget] = useState<Appointment | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function request(appointment: Appointment) {
    setTarget(appointment);
    setError(null);
  }

  function cancel() {
    setTarget(null);
  }

  async function confirm(appointment: Appointment) {
    setIsPending(true);
    setError(null);
    try {
      const cancelled = await cancelAppointment(appointment.id);
      setTarget(null);
      onCancelled(cancelled);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 404) {
        setTarget(null);
        onCancelled({ ...appointment, status: 'CANCELADA' });
        return;
      }
      setError(describeMutationError(reason));
    } finally {
      setIsPending(false);
    }
  }

  return { target, isPending, error, request, cancel, confirm };
}
