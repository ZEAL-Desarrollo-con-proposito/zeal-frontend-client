import { delay, http, HttpResponse } from 'msw';
import {
  MARK_ALL_READ_ENDPOINT,
  NOTIFICATIONS_ENDPOINT,
} from '@/features/notifications/api/notificationsApi';
import { byNewest } from '@/features/notifications/model/notification';
import { NOTIFICATIONS_QUEUE } from '@/features/notifications/model/notificationEvent';
import { authenticate, errorBody } from '../mockAuth';
import { publishToUser } from '../realtime';
import { readNotificationsDb, toNotification, writeNotificationsDb } from './db';

/** Servicio de notificaciones simulado: cada persona solo ve y cambia las suyas. */
export const notificationHandlers = [
  http.get(`*${NOTIFICATIONS_ENDPOINT}`, async ({ request }) => {
    await delay();
    const user = authenticate(request);
    if (user instanceof Response) {
      return user;
    }
    const own = readNotificationsDb()
      .notifications.filter(({ userId }) => userId === user.id)
      .map(toNotification)
      .sort(byNewest);
    return HttpResponse.json(own);
  }),

  http.post(`*${MARK_ALL_READ_ENDPOINT}`, async ({ request }) => {
    await delay();
    const user = authenticate(request);
    if (user instanceof Response) {
      return user;
    }
    const db = readNotificationsDb();
    const ids: string[] = [];
    for (const notification of db.notifications) {
      if (notification.userId === user.id && !notification.read) {
        notification.read = true;
        ids.push(notification.id);
      }
    }
    writeNotificationsDb(db);
    // Las demás pestañas y equipos de la persona se ponen al día.
    publishToUser(user.id, NOTIFICATIONS_QUEUE, { type: 'LEIDAS', ids });
    return new HttpResponse(null, { status: 204 });
  }),

  http.post<{ id: string }>(`*${NOTIFICATIONS_ENDPOINT}/:id/leida`, async ({ request, params }) => {
    await delay();
    const user = authenticate(request);
    if (user instanceof Response) {
      return user;
    }
    const db = readNotificationsDb();
    const notification = db.notifications.find(
      ({ id, userId }) => id === params.id && userId === user.id,
    );
    if (notification === undefined) {
      return errorBody(404, 'Not Found', 'La notificación ya no existe');
    }
    notification.read = true;
    writeNotificationsDb(db);
    publishToUser(user.id, NOTIFICATIONS_QUEUE, { type: 'LEIDAS', ids: [notification.id] });
    return new HttpResponse(null, { status: 204 });
  }),
];
