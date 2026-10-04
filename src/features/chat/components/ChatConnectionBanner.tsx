import type { RealtimeStatus } from '@/shared/realtime/realtimeClient';
import styles from './ChatConnectionBanner.module.css';

/** `connected` no muestra nada: el aviso solo existe para interrumpir, no para confirmar. */
const MESSAGE: Partial<Record<RealtimeStatus, string>> = {
  connecting: 'Conectando…',
  reconnecting: 'Conexión perdida. Reconectando…',
  idle: 'Sin conexión en tiempo real.',
};

interface ChatConnectionBannerProps {
  status: RealtimeStatus;
}

/**
 * Aviso del estado de la conexión dentro del chat (HU-FE-09 · Task 351): mientras no está
 * conectado, no se pueden enviar mensajes (se perderían en silencio), así que la persona necesita
 * saberlo. Desaparece sola en cuanto `status` vuelve a `connected`.
 */
export function ChatConnectionBanner({ status }: Readonly<ChatConnectionBannerProps>) {
  const message = MESSAGE[status];
  if (message === undefined) {
    return null;
  }
  return (
    <p className={styles.banner} data-status={status} role="status">
      {message}
    </p>
  );
}
