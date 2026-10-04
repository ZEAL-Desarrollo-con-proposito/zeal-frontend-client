import { addDays, formatLongDate, isSameDay, toIsoDate } from '@/shared/lib/dates';
import type { ChatMessage } from './chatMessage';

/** Los mensajes de un mismo día, con separaciones ("Hoy", "Ayer" o la fecha). */
export interface ChatDayGroup {
  key: string;
  label: string;
  messages: ChatMessage[];
}

/** "Hoy", "Ayer" o "Martes, 23 de septiembre": como en cualquier chat, para ubicar la conversación. */
export function chatDayLabel(date: Date, now: number): string {
  const today = new Date(now);
  if (isSameDay(date, today)) {
    return 'Hoy';
  }
  if (isSameDay(date, addDays(today, -1))) {
    return 'Ayer';
  }
  return formatLongDate(date);
}

/**Agrupa los mensajes (ya en orden cronológico)*/
export function groupChatMessagesByDay(
  messages: readonly ChatMessage[],
  now: number,
): ChatDayGroup[] {
  const groups: ChatDayGroup[] = [];
  for (const message of messages) {
    const sentAt = new Date(message.sentAt);
    const key = toIsoDate(sentAt);
    const current = groups.at(-1);
    if (current?.key === key) {
      current.messages.push(message);
    } else {
      groups.push({
        key,
        label: chatDayLabel(sentAt, now),
        messages: [message],
      });
    }
  }
  return groups;
}
