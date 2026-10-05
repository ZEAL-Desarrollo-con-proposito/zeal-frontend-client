import { isRecord } from '@/features/auth/model/session';
import type { PresenceState } from './presence';

/**
 * Tópico de presencia de una persona en el Real-Time Gateway: cualquiera que lo necesite se
 * suscribe (osea el que tenga un chat con este), y el servidor avisa ahí sobre la presencia
 */
export function presenceTopic(userId: string): string {
  return `/topic/presencia/${encodeURIComponent(userId)}`;
}

export interface PresenceEvent {
  type: 'PRESENCIA';
  status: PresenceState;
}

export function isPresenceEvent(value: unknown): value is PresenceEvent {
  return (
    isRecord(value) &&
    value.type === 'PRESENCIA' &&
    (value.status === 'online' || value.status === 'offline')
  );
}
