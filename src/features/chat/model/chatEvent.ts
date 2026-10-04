import { isRecord } from '@/features/auth/model/session';
import type { ChatMessage } from './chatMessage';
import { isChatMessage } from './chatMessage';

/**
 * Cola privada en Real time por persona: mensajes nuevos de cualquiera de sus conversaciones.
 */
export const CHATS_QUEUE = '/user/queue/chats';

/** A dónde envía un mensaje cada participante; el servidor lo completa y lo reenvía a los dos. */
export function chatSendDestination(conversationId: string): string {
  return `/app/chats/${encodeURIComponent(conversationId)}/mensajes`;
}

export interface ChatOutgoing {
  text: string;
}

export function isChatOutgoing(value: unknown): value is ChatOutgoing {
  return isRecord(value) && typeof value.text === 'string' && value.text.trim() !== '';
}

/** `NUEVO`: llegó un mensaje — propio (eco del servidor) o de la otra persona. */
export interface ChatEvent {
  type: 'NUEVO';
  message: ChatMessage;
}

export function isChatEvent(value: unknown): value is ChatEvent {
  return isRecord(value) && value.type === 'NUEVO' && isChatMessage(value.message);
}
