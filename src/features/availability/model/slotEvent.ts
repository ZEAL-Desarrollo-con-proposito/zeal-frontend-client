import { isRecord } from '@/features/auth/model/session';
import type { Slot } from './slot';
import { isSlot } from './slot';

/** Destino STOMP donde el Real-Time Gateway difunde los cambios de franjas (RT-2). */
export const SLOTS_TOPIC = '/topic/franjas';

export const SLOT_EVENT_TYPES = ['CREADA', 'ELIMINADA', 'ACTUALIZADA'] as const;

export type SlotEventType = (typeof SLOT_EVENT_TYPES)[number];

export interface SlotEvent {
  type: SlotEventType;
  slot: Slot;
}

export function isSlotEvent(value: unknown): value is SlotEvent {
  return (
    isRecord(value) && SLOT_EVENT_TYPES.some((type) => type === value.type) && isSlot(value.slot)
  );
}
