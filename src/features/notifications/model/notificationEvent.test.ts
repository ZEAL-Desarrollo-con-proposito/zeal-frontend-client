import { describe, expect, it } from 'vitest';
import type { Notification } from './notification';
import { isNotificationEvent, toastFor } from './notificationEvent';

const notification: Notification = {
  id: 'notificacion-9',
  type: 'RESERVA_CONFIRMADA',
  title: 'Tu cita quedó confirmada',
  message: 'Laura Martínez · miércoles, 23 de septiembre de 10:00 a 10:50',
  createdAt: new Date(2026, 8, 23, 9).toISOString(),
  read: false,
  link: '/empleado/mis-citas',
};

describe('isNotificationEvent', () => {
  it('acepta una notificación nueva y un aviso de leídas', () => {
    expect(isNotificationEvent({ type: 'NUEVA', notification })).toBe(true);
    expect(isNotificationEvent({ type: 'LEIDAS', ids: ['a', 'b'] })).toBe(true);
    expect(isNotificationEvent({ type: 'LEIDAS', ids: [] })).toBe(true);
  });

  it.each<[string, unknown]>([
    ['un valor que no es objeto', 'NUEVA'],
    ['un tipo desconocido', { type: 'BORRADA', ids: [] }],
    ['una nueva sin notificación válida', { type: 'NUEVA', notification: { id: 'x' } }],
    ['unas leídas sin lista', { type: 'LEIDAS', ids: 'a' }],
    ['unas leídas con ids no textuales', { type: 'LEIDAS', ids: [1] }],
  ])('rechaza %s', (_case, value) => {
    expect(isNotificationEvent(value)).toBe(false);
  });
});

describe('toastFor', () => {
  it('celebra una reserva confirmada y lleva a Mis citas', () => {
    expect(toastFor(notification)).toEqual({
      tone: 'success',
      title: 'Tu cita quedó confirmada',
      message: 'Laura Martínez · miércoles, 23 de septiembre de 10:00 a 10:50',
      action: { label: 'Ver mis citas', to: '/empleado/mis-citas' },
    });
  });

  it('informa cualquier otra notificación, con o sin destino', () => {
    const other = { ...notification, type: 'BLOQUES_NUEVOS', link: '/empleado/bienestar' };
    expect(toastFor(other)).toMatchObject({
      tone: 'info',
      action: { label: 'Ver', to: '/empleado/bienestar' },
    });
    expect(toastFor({ ...other, link: null })).not.toHaveProperty('action');
  });
});
