import { InvalidResponseError } from '@/shared/api/errors';
import { request } from '@/shared/api/httpClient';
import type { ChatMessage } from '../model/chatMessage';
import { isChatMessage } from '../model/chatMessage';

export const CHATS_ENDPOINT = '/api/chats';

export function chatHistoryEndpoint(conversationId: string): string {
  return `${CHATS_ENDPOINT}/${encodeURIComponent(conversationId)}/mensajes`;
}

/**
 * Historial de una conversación (HU-FE-09 · Task 350), del más antiguo al más reciente. El
 * servidor solo lo entrega a los dos participantes.
 */
export async function fetchChatHistory(
  conversationId: string,
  signal?: AbortSignal,
): Promise<ChatMessage[]> {
  const payload = await request(chatHistoryEndpoint(conversationId), { signal });
  if (!Array.isArray(payload) || !payload.every(isChatMessage)) {
    throw new InvalidResponseError('el historial del chat');
  }
  return payload;
}
