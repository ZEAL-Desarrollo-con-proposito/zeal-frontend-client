import type { LoadStatus } from '@/shared/hooks/useFetch';
import type { Notification } from './notification';
import { byNewest } from './notification';

export interface NotificationsState {
  /** Carga vigente: solo su respuesta se aplica (la última petición gana). */
  requestId: number;
  status: LoadStatus;
  items: Notification[];
  /** Llegadas en vivo durante una carga: se suman a la respuesta del servidor. */
  pending: Notification[];
}

export type NotificationsAction =
  | { type: 'load-start'; requestId: number }
  | { type: 'load-success'; requestId: number; items: Notification[] }
  | { type: 'load-failure'; requestId: number }
  | { type: 'received'; notification: Notification }
  | { type: 'read'; ids: readonly string[] }
  | { type: 'unread'; ids: readonly string[] };

export const INITIAL_NOTIFICATIONS_STATE: NotificationsState = {
  requestId: 0,
  status: 'loading',
  items: [],
  pending: [],
};

/** Inserta o reemplaza por id (llegar dos veces no duplica) y mantiene el orden por fecha. */
function upsert(items: readonly Notification[], notification: Notification): Notification[] {
  return [...items.filter(({ id }) => id !== notification.id), notification].sort(byNewest);
}

function setRead(items: readonly Notification[], ids: readonly string[], read: boolean) {
  return items.map((item) => (ids.includes(item.id) ? { ...item, read } : item));
}

export function notificationsReducer(
  state: NotificationsState,
  action: NotificationsAction,
): NotificationsState {
  switch (action.type) {
    case 'load-start':
      return { ...state, requestId: action.requestId, status: 'loading', pending: [] };
    case 'load-success':
      if (action.requestId !== state.requestId) {
        return state;
      }
      return {
        ...state,
        status: 'ready',
        items: state.pending.reduce(upsert, [...action.items].sort(byNewest)),
        pending: [],
      };
    case 'load-failure':
      return action.requestId === state.requestId ? { ...state, status: 'error' } : state;
    case 'received':
      return {
        ...state,
        items: upsert(state.items, action.notification),
        pending: state.status === 'loading' ? [...state.pending, action.notification] : [],
      };
    case 'read':
      return { ...state, items: setRead(state.items, action.ids, true) };
    case 'unread':
      return { ...state, items: setRead(state.items, action.ids, false) };
  }
}
