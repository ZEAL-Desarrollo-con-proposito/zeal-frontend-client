import { useEffect, useReducer, useRef, useState } from 'react';
import { ApiError } from '@/shared/api/errors';
import { useToast } from '@/shared/ui/Toast/useToast';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notificationsApi';
import { unreadIds } from '../model/notification';
import { INITIAL_NOTIFICATIONS_STATE, notificationsReducer } from '../model/notificationsState';

/**
 * Notificaciones de la persona: se cargan al entrar y se marcan como leídas al instante
 * (optimista). Si el servidor rechaza el cambio, se revierte y se avisa.
 */
export function useNotifications() {
  const [state, dispatch] = useReducer(notificationsReducer, INITIAL_NOTIFICATIONS_STATE);
  const [attempt, setAttempt] = useState(0);
  const requestCounter = useRef(0);
  const showToast = useToast();

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
  }, [attempt]);

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
