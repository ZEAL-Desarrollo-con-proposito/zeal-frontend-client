import { useEffect, useRef } from 'react';
import { avatarToneFor } from '@/features/directory/model/psychologist';
import { useNow } from '@/shared/hooks/useNow';
import { formatTime } from '@/shared/lib/dates';
import { Avatar } from '@/shared/ui/Avatar/Avatar';
import type { ChatMessage } from '../model/chatMessage';
import { groupChatMessagesByDay } from '../model/chatMessageGroups';
import { ChatComposer } from './ChatComposer';
import styles from './ChatWindow.module.css';

/** se revisa si es "hoy", "ayer" o "fecha" cada minuto*/
const DAY_LABEL_REFRESH_MS = 60_000;

/** La otra persona de la conversación: un psicólogo (con `title`) o un empleado (sin él). */
export interface ChatPeer {
  id: string;
  fullName: string;
  title?: string;
}

interface ChatWindowProps {
  peer: ChatPeer;
  currentUserId: string;
  messages: readonly ChatMessage[];
  onSend: (text: string) => void;
}

/**
 * Ventana de chat 1:1 (HU-FE-09 · Task 348): encabezado con la otra persona y la lista de
 * mensajes, agrupados por día y distinguiendo los propios de los suyos.(por ahora, solo lo que llegue en vivo con
 * `useChatClient`; Task 350 sumará el historial).
 */

export function ChatWindow({ peer, currentUserId, messages, onSend }: Readonly<ChatWindowProps>) {
  const listRef = useRef<HTMLDivElement>(null);

  // Cada mensaje nuevo lleva la conversación al fondo, como en cualquier chat.
  useEffect(() => {
    const list = listRef.current;
    if (list !== null) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages.length]);

  const now = useNow(DAY_LABEL_REFRESH_MS);
  const groups = groupChatMessagesByDay(messages, now);

  return (
    <section className={styles.window} aria-label={`Chat con ${peer.fullName}`}>
      <header className={styles.header}>
        <Avatar name={peer.fullName} tone={avatarToneFor(peer.id)} />
        <div className={styles.identity}>
          <p className={styles.name}>{peer.fullName}</p>
          {peer.title !== undefined && <p className={styles.role}>{peer.title}</p>}
        </div>
      </header>

      {messages.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Aún no tienes mensajes con {peer.fullName}</p>
          <p className={styles.emptyHint}>
            Escríbele cuando quieras, sin esperar a tu próxima sesión.
          </p>
        </div>
      ) : (
        <div
          ref={listRef}
          className={styles.list}
          role="log"
          aria-live="polite"
          aria-label={`Mensajes con ${peer.fullName}`}
        >
          {groups.map((group) => (
            <div key={group.key} className={styles.day}>
              <div className={styles.daySeparator}>
                <span>{group.label}</span>
              </div>
              {group.messages.map((message) => {
                const own = message.senderId === currentUserId;
                return (
                  <div key={message.id} className={styles.row} data-own={own}>
                    <div className={styles.bubble}>
                      <p className={styles.text}>
                        <span className="visually-hidden">{own ? 'Tú' : message.senderName}: </span>
                        {message.text}
                      </p>
                      <span className={styles.time}>{formatTime(new Date(message.sentAt))}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <ChatComposer onSend={onSend} />
    </section>
  );
}