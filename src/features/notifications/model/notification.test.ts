import { describe, expect, it } from 'vitest';
import type { Notification } from './notification';
import { byNewest, isNotification, relativeTime, unreadIds } from './notification';

const notification: Notification = {
  id: 'notificacion-1',
  type: 'RESERVA_CONFIRMADA',
  title: 'Tu cita quedó confirmada',
  message: 'Laura Martínez · miércoles, 23 de septiembre de 10:00 a 10:50',
  createdAt: new Date(2026, 8, 23, 9).toISOString(),
  read: false,
  link: '/empleado/mis-citas',
};

describe('isNotification', () => {
  it('acepta una notificación con o sin enlace interno', () => {
    expect(isNotification(notification)).toBe(true);
    expect(isNotification({ ...notification, link: null })).toBe(true);
  });

  it.each<[string, unknown]>([
    ['un valor que no es objeto', 'aviso'],
    ['un id no textual', { ...notification, id: 3 }],
    ['un tipo ausente', { ...notification, type: undefined }],
    ['un título ausente', { ...notification, title: null }],
    ['un mensaje ausente', { ...notification, message: undefined }],
    ['una fecha inválida', { ...notification, createdAt: 'ayer' }],
    ['un estado de lectura no booleano', { ...notification, read: 'no' }],
    ['un enlace externo', { ...notification, link: 'https://sitio-malicioso.com' }],
    ['un enlace a otro dominio sin esquema', { ...notification, link: '//sitio-malicioso.com' }],
    ['un enlace con esquema javascript', { ...notification, link: 'javascript:alert(1)' }],
    ['un enlace ausente', { ...notification, link: undefined }],
  ])('rechaza %s', (_case, value) => {
    expect(isNotification(value)).toBe(false);
  });
});

describe('relativeTime', () => {
  const created = new Date(2026, 8, 23, 9);
  const after = (minutes: number) => created.getTime() + minutes * 60_000;

  it.each([
    ['recién llegada', 0.5, 'Ahora'],
    ['con reloj adelantado del servidor', -2, 'Ahora'],
    ['de hace minutos', 5, 'Hace 5 min'],
    ['de hace horas', 150, 'Hace 2 h'],
    ['de ayer', 26 * 60, 'Ayer'],
    ['de hace días', 3 * 24 * 60, 'Hace 3 días'],
  ])('describe una notificación %s', (_case, minutes, text) => {
    expect(relativeTime(created.toISOString(), after(minutes))).toBe(text);
  });
});

describe('unreadIds y byNewest', () => {
  it('lista las no leídas y ordena de la más reciente a la más antigua', () => {
    const older = { ...notification, id: 'vieja', createdAt: new Date(2026, 8, 20).toISOString() };
    const read = { ...notification, id: 'leida', read: true };

    expect(unreadIds([notification, read, older])).toEqual(['notificacion-1', 'vieja']);
    expect([older, notification].sort(byNewest).map(({ id }) => id)).toEqual([
      'notificacion-1',
      'vieja',
    ]);
  });
});
