import { isRecord } from '@/features/auth/model/session';
import type { FreedSlotOffer } from './freedSlot';
import { isFreedSlotOffer } from './freedSlot';

/**
 * Cola privada de cupos liberados en el Real-Time Gateway (destino de usuario de STOMP): el
 * servidor solo la entrega a quien tiene una cita posterior el mismo día que el cupo liberado.
 */
export const FREED_SLOTS_QUEUE = '/user/queue/cupos-liberados';

/** `LIBERADO`: hay un cupo para competir. `TOMADO`: otra persona ya lo tomó. */
export type FreedSlotEvent =
  { type: 'LIBERADO'; offer: FreedSlotOffer } | { type: 'TOMADO'; offerId: string };

export function isFreedSlotEvent(value: unknown): value is FreedSlotEvent {
  if (!isRecord(value)) {
    return false;
  }
  if (value.type === 'LIBERADO') {
    return isFreedSlotOffer(value.offer);
  }
  return value.type === 'TOMADO' && typeof value.offerId === 'string';
}
