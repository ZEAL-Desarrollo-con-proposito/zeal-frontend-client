import type { Notification } from '@/features/notifications/model/notification';

/**
 * "Base de datos" del servicio de notificaciones simulado, en localStorage para compartirla entre
 * pestañas como con el backend real. Cada notificación pertenece a una persona.
 */
export interface NotificationRecord extends Notification {
  userId: string;
}

export interface NotificationsDb {
  notifications: NotificationRecord[];
  sequence: number;
}

export const NOTIFICATIONS_DB_KEY = 'zeal.mock.notificaciones';

const HOUR = 60 * 60_000;

/** Notificaciones de ejemplo, relativas a `now`, para que la campana tenga algo que mostrar. */
export function seedNotificationsDb(now: Date): NotificationsDb {
  const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * HOUR).toISOString();
  return {
    sequence: 3,
    notifications: [
      {
        id: 'notificacion-1',
        userId: 'usr-empleado-001',
        type: 'BIENVENIDA',
        title: 'Te damos la bienvenida a ZEAL',
        message: 'Tu espacio de bienestar ya está listo. Nadie en tu empresa verá lo que agendes.',
        createdAt: at(72),
        read: true,
        link: '/empleado/bienestar',
      },
      {
        id: 'notificacion-2',
        userId: 'usr-empleado-001',
        type: 'BLOQUES_NUEVOS',
        title: 'Laura Martínez abrió nuevos bloques',
        message: 'Hay bloques libres esta semana. Resérvalos antes de que se ocupen.',
        createdAt: at(2),
        read: false,
        link: '/empleado/bienestar/psicologos/usr-psicologo-001',
      },
      {
        id: 'notificacion-3',
        userId: 'usr-psicologo-001',
        type: 'AGENDA',
        title: 'Tienes sesiones programadas hoy',
        message: 'Revisa tu agenda para prepararte con calma.',
        createdAt: at(1),
        read: false,
        link: '/psicologo/agenda',
      },
    ],
  };
}

function isNotificationsDb(value: unknown): value is NotificationsDb {
  return (
    typeof value === 'object' &&
    value !== null &&
    'notifications' in value &&
    Array.isArray(value.notifications) &&
    'sequence' in value &&
    typeof value.sequence === 'number'
  );
}

export function readNotificationsDb(): NotificationsDb {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(NOTIFICATIONS_DB_KEY) ?? 'null');
    if (isNotificationsDb(stored)) {
      return stored;
    }
  } catch {
    // Datos corruptos: se vuelve a sembrar.
  }
  const seeded = seedNotificationsDb(new Date());
  writeNotificationsDb(seeded);
  return seeded;
}

export function writeNotificationsDb(db: NotificationsDb): void {
  localStorage.setItem(NOTIFICATIONS_DB_KEY, JSON.stringify(db));
}

/** Lo que ve su destinatario: la notificación sin el dueño. */
export function toNotification(record: NotificationRecord): Notification {
  const { id, type, title, message, createdAt, read, link } = record;
  return { id, type, title, message, createdAt, read, link };
}

/** Crea una notificación para una persona (como el servicio al recibir un evento del sistema). */
export function notify(
  userId: string,
  content: Pick<Notification, 'type' | 'title' | 'message' | 'link'>,
): Notification {
  const db = readNotificationsDb();
  db.sequence += 1;
  const record: NotificationRecord = {
    ...content,
    id: `notificacion-${String(db.sequence)}`,
    userId,
    createdAt: new Date().toISOString(),
    read: false,
  };
  db.notifications.push(record);
  writeNotificationsDb(db);
  return toNotification(record);
}
