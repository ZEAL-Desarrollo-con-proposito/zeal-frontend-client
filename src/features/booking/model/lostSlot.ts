import type { SlotEvent } from '@/features/availability/model/slotEvent';

/** El bloque que alguien estaba por reservar dejó de estar libre (lo tomaron o lo retiraron). */
export function isSlotLost({ type, slot }: SlotEvent): boolean {
  return type === 'ELIMINADA' || slot.status !== 'DISPONIBLE';
}

/** Por qué ya no se puede reservar el bloque elegido, con el siguiente paso claro. */
export function lostSlotMessage({ type }: SlotEvent): string {
  return type === 'ELIMINADA'
    ? 'El psicólogo retiró el bloque que elegiste. Elige otro bloque libre.'
    : 'Otra persona acaba de reservar el bloque que elegiste. Elige otro bloque libre.';
}
