import type { Slot } from '@/features/availability/model/slot';
import { compareByStart, describeSlot } from '@/features/availability/model/slot';
import type { SlotEvent } from '@/features/availability/model/slotEvent';

/**
 * Bloques de la semana que aún no empiezan, libres u ocupados (Figma B3), en orden. El servidor
 * entrega solo bloques futuros; un bloque puede empezar mientras la página sigue abierta.
 */
export function upcomingSlots(slots: readonly Slot[], now: number): Slot[] {
  return slots.filter((slot) => Date.parse(slot.startsAt) > now).sort(compareByStart);
}

/** Un empleado solo puede elegir un bloque libre. */
export function isBookable(slot: Slot): boolean {
  return slot.status === 'DISPONIBLE';
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
