import { useRef, useState } from 'react';
import type { Appointment } from '@/features/appointments/model/appointment';
import type { Slot } from '@/features/availability/model/slot';
import type { SlotEvent } from '@/features/availability/model/slotEvent';
import { isSlotLost, lostSlotMessage } from '../model/lostSlot';
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
  /** Por qué se soltó la selección (el bloque dejó de estar libre en vivo). */
  const [alert, setAlert] = useState<string | null>(null);
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
    alert,
    select: (slot: Slot) => {
      setBooked(null);
      setAlert(null);
      setSelected(slot);
    },
    clear: () => {
      setSelected(null);
    },
    /**
     * Cambio en vivo de un bloque: si era el elegido (o el que se está confirmando) y dejó de
     * estar libre, se suelta y se explica por qué. La reserva propia no cuenta.
     */
    slotChanged: (event: SlotEvent) => {
      if (!isSlotLost(event) || ownBookings.current.has(event.slot.id)) {
        return;
      }
      const message = lostSlotMessage(event);
      if (selected?.id === event.slot.id) {
        setSelected(null);
        setAlert(message);
      }
      if (booking.target?.id === event.slot.id) {
        booking.markUnavailable(message);
      }
    },
    dismissBooked: () => {
      setBooked(null);
    },
    isOwnBooking: (slotId: string) => ownBookings.current.has(slotId),
  };
}
