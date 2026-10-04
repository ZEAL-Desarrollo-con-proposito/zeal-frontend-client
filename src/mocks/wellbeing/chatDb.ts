import type { ChatMessage } from '@/features/chat/model/chatMessage';

/**
 * "Base de datos" de mensajes de chat del simulador (HU-BE-09), en localStorage para que el
 * historial sobreviva a recargar la página y se comparta entre pestañas, como con el backend real.
 */
export interface ChatDb {
  messages: ChatMessage[];
}

export const CHAT_DB_KEY = 'zeal.mock.mensajes';

function isChatDb(value: unknown): value is ChatDb {
  return (
    typeof value === 'object' &&
    value !== null &&
    'messages' in value &&
    Array.isArray((value as ChatDb).messages)
  );
}

export function readChatDb(): ChatDb {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(CHAT_DB_KEY) ?? 'null');
    if (isChatDb(stored)) {
      return stored;
    }
  } catch {
    // Datos corruptos: se empieza de cero.
  }
  return { messages: [] };
}

export function writeChatDb(db: ChatDb): void {
  localStorage.setItem(CHAT_DB_KEY, JSON.stringify(db));
}

export function appendChatMessage(message: ChatMessage): void {
  const db = readChatDb();
  db.messages.push(message);
  writeChatDb(db);
}

/** El historial de una conversación, del más antiguo al más reciente. */
export function historyOf(conversationId: string): ChatMessage[] {
  return readChatDb()
    .messages.filter((message) => message.conversationId === conversationId)
    .sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt));
}
