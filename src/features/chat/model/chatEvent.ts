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

/** A dónde se avisa que se está escribiendo (Task 355); el servidor reenvía a la otra persona. */
export function chatTypingDestination(conversationId: string): string {
  return `/app/chats/${encodeURIComponent(conversationId)}/escribiendo`;
}

export interface ChatTypingOutgoing {
  typing: boolean;
}

export function isChatTypingOutgoing(value: unknown): value is ChatTypingOutgoing {
  return isRecord(value) && typeof value.typing === 'boolean';
}

/** `ESCRIBIENDO`: la otra persona empezó o dejó de escribir en esta conversación. */
export interface ChatTypingEvent {
  type: 'ESCRIBIENDO';
  conversationId: string;
  userId: string;
  typing: boolean;
}

export function isChatTypingEvent(value: unknown): value is ChatTypingEvent {
  return (
    isRecord(value) &&
    value.type === 'ESCRIBIENDO' &&
    typeof value.conversationId === 'string' &&
    typeof value.userId === 'string' &&
    typeof value.typing === 'boolean'
  );
}
