import type { LoadStatus } from '@/shared/hooks/useFetch';
import { Button } from '@/shared/ui/Button/Button';
import type { Notification } from '../model/notification';
import { relativeTime } from '../model/notification';
import styles from './NotificationBell.module.css';

interface NotificationPanelProps {
  status: LoadStatus;
  notifications: readonly Notification[];
  unread: number;
  now: number;
  onOpen: (notification: Notification) => void;
  onMarkAll: () => void;
  onRetry: () => void;
}

/** Lista de notificaciones: las no leídas llevan un punto (y el texto "No leída" para lectores). */
export function NotificationPanel({
  status,
  notifications,
  unread,
  now,
  onOpen,
  onMarkAll,
  onRetry,
}: Readonly<NotificationPanelProps>) {
  return (
    <section className={styles.content} aria-labelledby="titulo-notificaciones">
      <header className={styles.header}>
        <h2 id="titulo-notificaciones" className={styles.title}>
          Notificaciones
        </h2>
        <button
          type="button"
          className={styles.markAll}
          disabled={unread === 0}
          onClick={onMarkAll}
        >
          Marcar todas como leídas
        </button>
      </header>

      {status === 'error' && (
        <div className={styles.state} role="alert">
          <p>No pudimos cargar tus notificaciones.</p>
          <Button variant="outline" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      )}
      {status === 'loading' && notifications.length === 0 && (
        <p className={styles.state}>Cargando notificaciones…</p>
      )}
      {status === 'ready' && notifications.length === 0 && (
        <p className={styles.state}>No tienes notificaciones.</p>
      )}

      {notifications.length > 0 && (
        <ul className={styles.list}>
          {notifications.map((notification) => (
            <li key={notification.id}>
              <button
                type="button"
                className={styles.item}
                data-read={notification.read}
                onClick={() => {
                  onOpen(notification);
                }}
              >
                <span className={styles.dot} aria-hidden="true" />
                <span className={styles.itemBody}>
                  <span className={styles.itemTitle}>{notification.title}</span>
                  <span className={styles.itemMessage}>{notification.message}</span>
                  <span className={styles.itemTime}>
                    {relativeTime(notification.createdAt, now)}
                    {!notification.read && <span className="visually-hidden"> · No leída</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
