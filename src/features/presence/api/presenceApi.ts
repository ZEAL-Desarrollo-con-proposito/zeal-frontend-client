import { InvalidResponseError } from '@/shared/api/errors';
import { request } from '@/shared/api/httpClient';
import type { PresenceState } from '../model/presence';
import { isPresenceSnapshot } from '../model/presence';

export const PRESENCE_ENDPOINT = '/api/presencia';

export function presenceEndpoint(userId: string): string {
  return `${PRESENCE_ENDPOINT}/${encodeURIComponent(userId)}`;
}

/** Presencia de una persona ahora mismo al abrir o al reconectar. */
export async function fetchPresence(userId: string, signal?: AbortSignal): Promise<PresenceState> {
  const payload = await request(presenceEndpoint(userId), { signal });
  if (!isPresenceSnapshot(payload) || payload.userId !== userId) {
    throw new InvalidResponseError('la presencia de esta persona');
  }
  return payload.status;
}
