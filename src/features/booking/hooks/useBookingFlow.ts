import { useRef, useState } from 'react';
import type { Appointment } from '@/features/appointments/model/appointment';
import type { Slot } from '@/features/availability/model/slot';
import { useBookSlot } from './useBookSlot';

interface BookingFlowOptions {
  /** Cita confirmada por el servidor: el bloque ya es de quien lo reservó. */
  onBooked: (slot: Slot) => void;
}

/**
 * Elegir un bloque → revisar el resumen → confirmar → ver la cita agendada (Figma B3 y B14).
 * Recuerda los bloques que reservó esta pestaña para no presentarlos como si los hubiera tomado
 * otra persona cuando llegue su evento en vivo.
 */
export function useBookingFlow({ onBooked }: BookingFlowOptions) {
  const [selected, setSelected] = useState<Slot | null>(null);
  const [booked, setBooked] = useState<Appointment | null>(null);
  const ownBookings = useRef(new Set<string>());

  const booking = useBookSlot({
    onBooked: (appointment, slot) => {
      ownBookings.current.add(slot.id);
      setSelected(null);
      setBooked(appointment);
      onBooked(slot);
    },
  });

  return {
    selected,
    booked,
    booking,
    select: (slot: Slot) => {
      setBooked(null);
      setSelected(slot);
    },
    clear: () => {
      setSelected(null);
    },
    dismissBooked: () => {
      setBooked(null);
    },
    isOwnBooking: (slotId: string) => ownBookings.current.has(slotId),
  };
}
