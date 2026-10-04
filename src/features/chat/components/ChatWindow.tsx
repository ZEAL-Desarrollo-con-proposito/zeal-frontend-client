import { useLayoutEffect, useRef } from 'react';
import { avatarToneFor } from '@/features/directory/model/psychologist';
import type { LoadStatus } from '@/shared/hooks/useFetch';
import { useNow } from '@/shared/hooks/useNow';
import { formatTime } from '@/shared/lib/dates';
import type { RealtimeStatus } from '@/shared/realtime/realtimeClient';
import { Avatar } from '@/shared/ui/Avatar/Avatar';
import { Button } from '@/shared/ui/Button/Button';
import type { ChatMessage } from '../model/chatMessage';
import { groupChatMessagesByDay } from '../model/chatMessageGroups';
import type { ChatPeer } from '../model/chatPeer';
import { ChatComposer } from './ChatComposer';
import { ChatConnectionBanner } from './ChatConnectionBanner';
import styles from './ChatWindow.module.css';

/** se revisa si es "hoy", "ayer" o "fecha" cada minuto*/
const DAY_LABEL_REFRESH_MS = 60_000;

interface ChatWindowProps {
  peer: ChatPeer;
  currentUserId: string;
  messages: readonly ChatMessage[];
  onSend: (text: string) => void;
  /** Carga del historial al abrir la conversación. */
  historyStatus: LoadStatus;
  onRetryHistory: () => void;
  /** Estado de la conexión en tiempo real (Task 351): sin ella, un mensaje se perdería en silencio. */
  connectionStatus: RealtimeStatus;
}

/**
 * Ventana de chat 1:1 (HU-FE-09 · Task 348): encabezado con la otra persona y la lista de
 * mensajes, agrupados por día y distinguiendo los propios de los suyos.
 */
export function ChatWindow({
  peer,
  currentUserId,
  messages,
  onSend,
  historyStatus,
  onRetryHistory,
  connectionStatus,
}: Readonly<ChatWindowProps>) {
  const listRef = useRef<HTMLDivElement>(null);

  // Al abrir la conversación (o cuando llega un mensaje nuevo), baja al final.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (list === null) {
      return;
    }
    const scrollToBottom = () => {
      list.scrollTop = list.scrollHeight;
    };
    scrollToBottom();
    const raf = requestAnimationFrame(scrollToBottom);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [messages.length, historyStatus]);

  const now = useNow(DAY_LABEL_REFRESH_MS);
  const groups = groupChatMessagesByDay(messages, now);
  const canSend = connectionStatus === 'connected';

  function renderBody() {
    if (historyStatus === 'loading' && messages.length === 0) {
      return (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Cargando mensajes…</p>
        </div>
      );
    }
    if (historyStatus === 'error' && messages.length === 0) {
      return (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No pudimos cargar los mensajes</p>
          <p className={styles.emptyHint}>Revisa tu conexión e inténtalo de nuevo.</p>
          <Button variant="outline" onClick={onRetryHistory}>
            Reintentar
          </Button>
        </div>
      );
    }
    if (messages.length === 0) {
      return (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Aún no tienes mensajes con {peer.fullName}</p>
          <p className={styles.emptyHint}>
            Escríbele cuando quieras, sin esperar a tu próxima sesión.
          </p>
        </div>
      );
    }
    return (
      <div
        ref={listRef}
        className={styles.list}
        role="log"
        aria-live="polite"
        aria-label={`Mensajes con ${peer.fullName}`}
      >
        {historyStatus === 'error' && (
          <p className={styles.historyError} role="alert">
            No pudimos cargar los mensajes anteriores.{' '}
            <button type="button" className={styles.retryLink} onClick={onRetryHistory}>
              Reintentar
            </button>
          </p>
        )}
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
    );
  }

  return (
    <section className={styles.window} aria-label={`Chat con ${peer.fullName}`}>
      <header className={styles.header}>
        <Avatar name={peer.fullName} tone={avatarToneFor(peer.id)} />
        <div className={styles.identity}>
          <p className={styles.name}>{peer.fullName}</p>
          {peer.title !== undefined && <p className={styles.role}>{peer.title}</p>}
        </div>
      </header>

      <ChatConnectionBanner status={connectionStatus} />

      {renderBody()}

      <ChatComposer onSend={onSend} disabled={!canSend} />
    </section>
  );
}
