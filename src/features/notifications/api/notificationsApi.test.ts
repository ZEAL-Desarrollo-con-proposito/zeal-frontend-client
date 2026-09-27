import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Role } from '@/features/auth/model/session';
import { server } from '@/mocks/server';
import { readNotificationsDb, writeNotificationsDb } from '@/mocks/notifications/db';
import { InvalidResponseError } from '@/shared/api/errors';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { freezeTime } from '@/test/clock';
import { buildSession } from '@/test/credentials';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATIONS_ENDPOINT,
} from './notificationsApi';

function authenticateAs(role: Role) {
  configureHttpAuth({
    accessToken: buildSession(role).accessToken,
    onUnauthorized: () => undefined,
  });
}

function readStateOf(id: string) {
  return readNotificationsDb().notifications.find((notification) => notification.id === id)?.read;
}

describe('notificationsApi', () => {
  beforeEach(() => {
    freezeTime();
  });

  afterEach(() => {
    configureHttpAuth(null);
  });

  it('entrega solo las notificaciones propias, la más reciente primero', async () => {
    authenticateAs('EMPLEADO');

    const notifications = await fetchNotifications();

    expect(notifications.map(({ id }) => id)).toEqual(['notificacion-2', 'notificacion-1']);
    expect(notifications[0]).toMatchObject({
      read: false,
      title: 'Laura Martínez abrió nuevos bloques',
    });
    expect(notifications[0]).not.toHaveProperty('userId');

    authenticateAs('PSICOLOGO');
    expect((await fetchNotifications()).map(({ id }) => id)).toEqual(['notificacion-3']);
  });

  it('marca una notificación propia como leída y rechaza la ajena con 404', async () => {
    authenticateAs('EMPLEADO');

    await markNotificationRead('notificacion-2');
    expect(readStateOf('notificacion-2')).toBe(true);

    await expect(markNotificationRead('notificacion-3')).rejects.toMatchObject({ status: 404 });
    expect(readStateOf('notificacion-3')).toBe(false);
  });

  it('marca todas las propias como leídas, sin tocar las de otras personas', async () => {
    authenticateAs('EMPLEADO');
    const db = readNotificationsDb();
    db.notifications.forEach((notification) => {
      notification.read = false;
    });
    writeNotificationsDb(db);

    await markAllNotificationsRead();

    expect(readStateOf('notificacion-1')).toBe(true);
    expect(readStateOf('notificacion-2')).toBe(true);
    expect(readStateOf('notificacion-3')).toBe(false);
  });

  it('exige una sesión válida', async () => {
    await expect(fetchNotifications()).rejects.toMatchObject({ status: 401 });
    await expect(markNotificationRead('notificacion-1')).rejects.toMatchObject({ status: 401 });
    await expect(markAllNotificationsRead()).rejects.toMatchObject({ status: 401 });
  });

  it('codifica el id y valida la respuesta', async () => {
    let path = '';
    server.use(
      http.post(`*${NOTIFICATIONS_ENDPOINT}/:id/leida`, ({ request }) => {
        path = new URL(request.url).pathname;
        return new HttpResponse(null, { status: 204 });
      }),
      http.get(`*${NOTIFICATIONS_ENDPOINT}`, () => HttpResponse.json([{ id: 'x' }]), {
        once: true,
      }),
    );
    authenticateAs('EMPLEADO');

    await markNotificationRead('a/b');
    expect(path).toBe(`${NOTIFICATIONS_ENDPOINT}/a%2Fb/leida`);
    await expect(fetchNotifications()).rejects.toBeInstanceOf(InvalidResponseError);
    server.use(http.get(`*${NOTIFICATIONS_ENDPOINT}`, () => HttpResponse.json({})));
    await expect(fetchNotifications()).rejects.toBeInstanceOf(InvalidResponseError);
  });

  it('vuelve a sembrar si lo guardado está corrupto', async () => {
    localStorage.setItem('zeal.mock.notificaciones', '{corrupto');
    authenticateAs('EMPLEADO');
    expect(await fetchNotifications()).toHaveLength(2);

    localStorage.setItem('zeal.mock.notificaciones', JSON.stringify({ notifications: [] }));
    expect(await fetchNotifications()).toHaveLength(2);
  });
});
