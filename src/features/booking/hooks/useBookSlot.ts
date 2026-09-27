import { useState } from 'react';
import type { Appointment } from '@/features/appointments/model/appointment';
import type { Slot } from '@/features/availability/model/slot';
import { describeMutationError } from '@/shared/api/describeError';
import { bookSlot } from '../api/bookingApi';

interface BookSlotHandlers {
  onBooked: (appointment: Appointment, slot: Slot) => void;
}

/**
 * Flujo "agendar cita" con confirmación: `request` abre la confirmación de un bloque y `confirm`
 * lo reserva. Mientras la petición está en curso el botón queda bloqueado (sin doble envío).
 */
export function useBookSlot({ onBooked }: BookSlotHandlers) {
  const [target, setTarget] = useState<Slot | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function request(slot: Slot) {
    setTarget(slot);
    setError(null);
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
      setError(describeMutationError(reason));
    } finally {
      setIsPending(false);
    }
  }

  return { target, isPending, error, request, cancel, confirm };
}
