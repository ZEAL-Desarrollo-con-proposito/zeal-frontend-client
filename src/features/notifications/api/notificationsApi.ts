import { InvalidResponseError } from '@/shared/api/errors';
import { request } from '@/shared/api/httpClient';
import type { Notification } from '../model/notification';
import { isNotification } from '../model/notification';

export const NOTIFICATIONS_ENDPOINT = '/api/notificaciones';
export const MARK_ALL_READ_ENDPOINT = `${NOTIFICATIONS_ENDPOINT}/leidas`;

export function markReadEndpoint(id: string): string {
  return `${NOTIFICATIONS_ENDPOINT}/${encodeURIComponent(id)}/leida`;
}

/** Notificaciones de la persona autenticada, la más reciente primero. */
export async function fetchNotifications(signal?: AbortSignal): Promise<Notification[]> {
  const payload = await request(NOTIFICATIONS_ENDPOINT, { signal });
  if (!Array.isArray(payload) || !payload.every(isNotification)) {
    throw new InvalidResponseError('tus notificaciones');
  }
  return payload;
}

export async function markNotificationRead(id: string): Promise<void> {
  await request(markReadEndpoint(id), { method: 'POST' });
}

export async function markAllNotificationsRead(): Promise<void> {
  await request(MARK_ALL_READ_ENDPOINT, { method: 'POST' });
}
