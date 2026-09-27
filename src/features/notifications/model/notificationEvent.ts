import { isRecord } from '@/features/auth/model/session';
import type { ToastInput } from '@/shared/ui/Toast/toast';
import type { Notification } from './notification';
import { isNotification } from './notification';

/**
 * Cola privada de cada persona en el Real-Time Gateway (destino de usuario de STOMP): el
 * servidor solo entrega aquí lo que le corresponde a quien está conectado.
 */
export const NOTIFICATIONS_QUEUE = '/user/queue/notificaciones';

/** `NUEVA`: llegó una notificación. `LEIDAS`: se marcaron como leídas en otra pestaña o equipo. */
export type NotificationEvent =
  { type: 'NUEVA'; notification: Notification } | { type: 'LEIDAS'; ids: string[] };

export function isNotificationEvent(value: unknown): value is NotificationEvent {
  if (!isRecord(value)) {
    return false;
  }
  if (value.type === 'NUEVA') {
    return isNotification(value.notification);
  }
  return (
    value.type === 'LEIDAS' &&
    Array.isArray(value.ids) &&
    value.ids.every((id) => typeof id === 'string')
  );
}

const ACTION_LABELS: Partial<Record<string, string>> = {
  RESERVA_CONFIRMADA: 'Ver mis citas',
};

/** Aviso emergente de una notificación nueva: una reserva confirmada se celebra en salvia. */
export function toastFor({ type, title, message, link }: Notification): ToastInput {
  return {
    tone: type === 'RESERVA_CONFIRMADA' ? 'success' : 'info',
    title,
    message,
    ...(link === null ? {} : { action: { label: ACTION_LABELS[type] ?? 'Ver', to: link } }),
  };
}
