import { isRecord } from '@/features/auth/model/session';

/** Si la otra persona está conectada al Real-Time Gateway ahora mismo (HU-FE-10). */
export type PresenceState = 'online' | 'offline';

/** Lo que entrega el servidor al consultar la presencia de una persona por su id. */
export interface PresenceSnapshot {
  userId: string;
  status: PresenceState;
}

function isPresenceState(value: unknown): value is PresenceState {
  return value === 'online' || value === 'offline';
}

export function isPresenceSnapshot(value: unknown): value is PresenceSnapshot {
  return isRecord(value) && typeof value.userId === 'string' && isPresenceState(value.status);
}
