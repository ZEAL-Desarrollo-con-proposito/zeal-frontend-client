import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { useNow } from '@/shared/hooks/useNow';
import { BellIcon } from '@/shared/ui/icons';
import { useNotifications } from '../hooks/useNotifications';
import type { Notification } from '../model/notification';
import { NotificationPanel } from './NotificationPanel';
import styles from './NotificationBell.module.css';

function bellLabel(unread: number): string {
  if (unread === 0) {
    return 'Notificaciones';
  }
  return unread === 1 ? 'Notificaciones, 1 sin leer' : `Notificaciones, ${String(unread)} sin leer`;
}

/**
 * Campana de la barra superior (Figma, "Notif") con el contador de no leídas. Abre un panel que
 * se cierra con Escape (el foco vuelve a la campana) o al tocar fuera.
 */
export function NotificationBell() {
  const now = useNow();
  const navigate = useNavigate();
  const notifications = useNotifications();
  const [open, setOpen] = useState(false);
  /** Se marca en cada toque dentro de la campana o su panel, antes de que llegue al documento. */
  const pressedInside = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const { unread } = notifications;

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    // El toque que abrió el panel no cuenta: solo los que llegan con el panel abierto.
    pressedInside.current = false;
    function closeOnOutsidePointer() {
      if (!pressedInside.current) {
        setOpen(false);
      }
      pressedInside.current = false;
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  function openNotification(notification: Notification) {
    void notifications.markAsRead(notification.id);
    setOpen(false);
    if (notification.link !== null) {
      void navigate(notification.link);
    }
  }

  return (
    <div
      className={styles.bell}
      onPointerDownCapture={() => {
        pressedInside.current = true;
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={styles.button}
        aria-label={bellLabel(unread)}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <BellIcon />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key={unread}
              className={styles.count}
              aria-hidden="true"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 520, damping: 22 }}
            >
              {unread > 9 ? '9+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={panelId}
            className={styles.panel}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <NotificationPanel
              status={notifications.status}
              notifications={notifications.notifications}
              unread={unread}
              now={now}
              onOpen={openNotification}
              onMarkAll={() => {
                void notifications.markAllAsRead();
              }}
              onRetry={notifications.reload}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
