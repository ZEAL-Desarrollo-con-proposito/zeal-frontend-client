import type { Slot } from '@/features/availability/model/slot';
import { compareByStart, describeSlot } from '@/features/availability/model/slot';
import type { SlotEvent } from '@/features/availability/model/slotEvent';

/**
 * Bloques que el empleado puede reservar entre los que tiene en pantalla. El servidor entrega solo
 * bloques libres y futuros; los eventos en vivo también traen los que alguien reserva, y un bloque
 * puede empezar mientras la página sigue abierta.
 */
export function bookableSlots(slots: readonly Slot[], now: number): Slot[] {
  return slots
    .filter((slot) => slot.status === 'DISPONIBLE' && Date.parse(slot.startsAt) > now)
    .sort(compareByStart);
}

/** Aviso para el empleado cuando cambia en vivo un bloque del psicólogo que está viendo. */
export function freeSlotNotice({ type, slot }: SlotEvent): string {
  const when = describeSlot(slot);
  switch (type) {
    case 'CREADA':
      return `Se abrió un bloque nuevo el ${when}.`;
    case 'ELIMINADA':
      return `Se retiró el bloque del ${when}.`;
    case 'ACTUALIZADA':
      return slot.status === 'RESERVADA'
        ? `Alguien acaba de reservar el bloque del ${when}.`
        : `Se liberó el bloque del ${when}.`;
  }
}
