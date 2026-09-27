import { isRecord } from '@/features/auth/model/session';

/** Notificación de la persona autenticada (contrato con el servicio de notificaciones, HU-BE-06). */
export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  /** Ruta interna a la que lleva la notificación, o `null`. */
  link: string | null;
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/** Solo rutas internas ("/empleado/…"): nunca una URL externa ni un esquema como javascript:. */
function isInternalLink(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && /^\/(?!\/)/.test(value));
}

export function isNotification(value: unknown): value is Notification {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.title === 'string' &&
    typeof value.message === 'string' &&
    isIsoDateTime(value.createdAt) &&
    typeof value.read === 'boolean' &&
    isInternalLink(value.link)
  );
}

export function unreadIds(notifications: readonly Notification[]): string[] {
  return notifications.filter(({ read }) => !read).map(({ id }) => id);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "Ahora", "Hace 5 min", "Hace 2 h", "Ayer" o "Hace 3 días" (Figma E1). */
export function relativeTime(createdAt: string, now: number): string {
  const elapsed = Math.max(0, now - Date.parse(createdAt));
  if (elapsed < MINUTE) {
    return 'Ahora';
  }
  if (elapsed < HOUR) {
    return `Hace ${String(Math.floor(elapsed / MINUTE))} min`;
  }
  if (elapsed < DAY) {
    return `Hace ${String(Math.floor(elapsed / HOUR))} h`;
  }
  const days = Math.floor(elapsed / DAY);
  return days === 1 ? 'Ayer' : `Hace ${String(days)} días`;
}

/** La más reciente primero. */
export function byNewest(a: Notification, b: Notification): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}
