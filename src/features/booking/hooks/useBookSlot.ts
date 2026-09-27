import { useState } from 'react';
import type { Appointment } from '@/features/appointments/model/appointment';
import type { Slot } from '@/features/availability/model/slot';
import { describeMutationError } from '@/shared/api/describeError';
import { ApiError } from '@/shared/api/errors';
import { bookSlot } from '../api/bookingApi';

interface BookSlotHandlers {
  onBooked: (appointment: Appointment, slot: Slot) => void;
  /**
   * El servidor rechazó la reserva por el estado del bloque (409 tomado o cruzado, 404 retirado,
   * 400 ya empezó): reintentar no sirve, hay que elegir otro bloque.
   */
  onRejected: (message: string) => void;
}

/**
 * Flujo "agendar cita" con confirmación: `request` abre la confirmación de un bloque y `confirm`
 * lo reserva. Mientras la petición está en curso el botón queda bloqueado (sin doble envío). Un
 * fallo de conexión deja reintentar; un rechazo del servidor cierra la confirmación.
 */
export function useBookSlot({ onBooked, onRejected }: BookSlotHandlers) {
  const [target, setTarget] = useState<Slot | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  function request(slot: Slot) {
    setTarget(slot);
    setError(null);
    setUnavailable(false);
  }

  /** El bloque en confirmación dejó de estar libre en vivo: ya no se puede confirmar. */
  function markUnavailable(message: string) {
    setError(message);
    setUnavailable(true);
  }

  function cancel() {
    setTarget(null);
  }

  async function confirm(slot: Slot) {
    setIsPending(true);
    setError(null);
    try {
      const appointment = await bookSlot(slot.id);
      setTarget(null);
      onBooked(appointment, slot);
    } catch (reason) {
      const message = describeMutationError(reason);
      if (reason instanceof ApiError && reason.status < 500) {
        setTarget(null);
        onRejected(message);
        return;
      }
      setError(message);
    } finally {
      setIsPending(false);
    }
  }

  return { target, isPending, error, unavailable, request, markUnavailable, cancel, confirm };
}
