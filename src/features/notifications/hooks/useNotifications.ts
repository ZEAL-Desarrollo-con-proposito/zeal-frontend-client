import { useEffect, useReducer, useRef, useState } from 'react';
import { ApiError } from '@/shared/api/errors';
import { useRealtimeStatus, useRealtimeSubscription } from '@/shared/realtime/useRealtime';
import { useToast } from '@/shared/ui/Toast/useToast';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notificationsApi';
import { unreadIds } from '../model/notification';
import { isNotificationEvent, NOTIFICATIONS_QUEUE, toastFor } from '../model/notificationEvent';
import { INITIAL_NOTIFICATIONS_STATE, notificationsReducer } from '../model/notificationsState';

/**
 * Notificaciones de la persona, al día en tiempo real (RT-2):
 * - las nuevas llegan por su cola privada y se anuncian con un aviso emergente (una sola vez);
 * - las marcadas como leídas en otra pestaña o equipo se reflejan al instante;
 * - al recuperarse la conexión se vuelve a pedir la lista para no perder nada.
 * Marcar como leída es optimista: si el servidor rechaza el cambio, se revierte y se avisa.
 */
export function useNotifications() {
  const [state, dispatch] = useReducer(notificationsReducer, INITIAL_NOTIFICATIONS_STATE);
  const [attempt, setAttempt] = useState(0);
  const requestCounter = useRef(0);
  /** Avisos ya mostrados: si una notificación llega dos veces, se anuncia una sola. */
  const announced = useRef(new Set<string>());
  const showToast = useToast();
  const { recoveries } = useRealtimeStatus();

  useEffect(() => {
    requestCounter.current += 1;
    const requestId = requestCounter.current;
    const controller = new AbortController();
    dispatch({ type: 'load-start', requestId });
    fetchNotifications(controller.signal).then(
      (items) => {
        dispatch({ type: 'load-success', requestId, items });
      },
      () => {
        dispatch({ type: 'load-failure', requestId });
      },
    );
    return () => {
      controller.abort();
    };
  }, [attempt, recoveries]);

  useRealtimeSubscription(NOTIFICATIONS_QUEUE, (payload) => {
    if (!isNotificationEvent(payload)) {
      return;
    }
    if (payload.type === 'LEIDAS') {
      dispatch({ type: 'read', ids: payload.ids });
      return;
    }
    const { notification } = payload;
    const known = state.items.some(({ id }) => id === notification.id);
    if (!known && !announced.current.has(notification.id)) {
      announced.current.add(notification.id);
      showToast(toastFor(notification));
    }
    dispatch({ type: 'received', notification });
  });

  /** Marca como leídas; si falla, deshace el cambio (una ya eliminada se da por leída). */
  async function markRead(ids: string[], save: () => Promise<void>) {
    if (ids.length === 0) {
      return;
    }
    dispatch({ type: 'read', ids });
    try {
      await save();
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return;
      }
      dispatch({ type: 'unread', ids });
      showToast({
        tone: 'warning',
        title: 'No pudimos marcar como leída',
        message: 'Revisa tu conexión e inténtalo de nuevo.',
      });
    }
  }

  return {
    status: state.status,
    notifications: state.items,
    unread: unreadIds(state.items).length,
    reload: () => {
      setAttempt((current) => current + 1);
    },
    markAsRead: (id: string) =>
      markRead(
        unreadIds(state.items).filter((unread) => unread === id),
        () => markNotificationRead(id),
      ),
    markAllAsRead: () => markRead(unreadIds(state.items), markAllNotificationsRead),
  };
}
