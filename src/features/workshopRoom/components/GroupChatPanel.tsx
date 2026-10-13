import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChatComposer } from '@/features/chat/components/ChatComposer';
import { formatTime } from '@/shared/lib/dates';
import { AlertIcon } from '@/shared/ui/icons';
import type { GroupChatMessage } from '../call/groupCall';
import styles from './GroupChatPanel.module.css';

interface GroupChatPanelProps {
  messages: readonly GroupChatMessage[];
  failed: boolean;
  onSend: (text: string) => void;
}

/**
 * Chat del taller en vivo: preguntas y comentarios para todas las personas de la sala, al
 * instante. No se guarda: lo ve quien está adentro mientras dura la sesión.
 */
export function GroupChatPanel({ messages, failed, onSend }: Readonly<GroupChatPanelProps>) {
  const endRef = useRef<HTMLLIElement>(null);

  // El último mensaje siempre queda a la vista.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  return (
    <section className={styles.panel} aria-label="Chat del taller">
      <header className={styles.header}>
        <h2 className={styles.title}>Chat del taller</h2>
        <p className={styles.hint}>Lo ven todas las personas en la sala. No se guarda.</p>
      </header>
      {messages.length === 0 ? (
        <p className={styles.empty}>Aún no hay mensajes. Escribe tu pregunta o comentario.</p>
      ) : (
        <ul className={styles.list} aria-label="Mensajes del taller" aria-live="polite">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.li
                key={message.id}
                className={styles.message}
                data-self={message.self}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
              >
                <p className={styles.meta}>
                  <span className={styles.sender}>{message.self ? 'Tú' : message.senderName}</span>
                  <time dateTime={message.sentAt}>{formatTime(new Date(message.sentAt))}</time>
                </p>
                <p className={styles.text}>{message.text}</p>
              </motion.li>
            ))}
          </AnimatePresence>
          <li ref={endRef} aria-hidden="true" className={styles.end} />
        </ul>
      )}
      {failed && (
        <p role="alert" className={styles.alert}>
          <AlertIcon />
          No se pudo enviar tu mensaje. Revisa tu conexión e inténtalo de nuevo.
        </p>
      )}
      <ChatComposer onSend={onSend} />
    </section>
  );
}
