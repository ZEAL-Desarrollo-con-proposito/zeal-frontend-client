import { describe, expect, it } from 'vitest';
import type { Notification } from './notification';
import { INITIAL_NOTIFICATIONS_STATE, notificationsReducer } from './notificationsState';

function notification(id: string, hour: number, read = false): Notification {
  return {
    id,
    type: 'AVISO',
    title: id,
    message: 'Mensaje',
    createdAt: new Date(2026, 8, 23, hour).toISOString(),
    read,
    link: null,
  };
}

const loading = notificationsReducer(INITIAL_NOTIFICATIONS_STATE, {
  type: 'load-start',
  requestId: 1,
});

describe('notificationsReducer', () => {
  it('aplica solo la respuesta de la carga vigente, ordenada de la más reciente', () => {
    const stale = notificationsReducer(loading, {
      type: 'load-success',
      requestId: 0,
      items: [notification('vieja', 8)],
    });
    expect(stale).toBe(loading);

    const ready = notificationsReducer(loading, {
      type: 'load-success',
      requestId: 1,
      items: [notification('a', 8), notification('b', 10)],
    });
    expect(ready.status).toBe('ready');
    expect(ready.items.map(({ id }) => id)).toEqual(['b', 'a']);
  });

  it('marca el error solo de la carga vigente', () => {
    expect(notificationsReducer(loading, { type: 'load-failure', requestId: 0 })).toBe(loading);
    expect(notificationsReducer(loading, { type: 'load-failure', requestId: 1 }).status).toBe(
      'error',
    );
  });

  it('suma a la respuesta lo que llegó en vivo mientras cargaba, sin duplicar', () => {
    const live = notification('en-vivo', 11);
    const withPending = notificationsReducer(loading, { type: 'received', notification: live });

    const ready = notificationsReducer(withPending, {
      type: 'load-success',
      requestId: 1,
      items: [notification('a', 8), live],
    });

    expect(ready.items.map(({ id }) => id)).toEqual(['en-vivo', 'a']);
    expect(ready.pending).toEqual([]);
  });

  it('agrega lo que llega en vivo con la lista cargada, sin duplicar', () => {
    const ready = notificationsReducer(loading, {
      type: 'load-success',
      requestId: 1,
      items: [notification('a', 8)],
    });
    const once = notificationsReducer(ready, {
      type: 'received',
      notification: notification('b', 12),
    });
    const twice = notificationsReducer(once, {
      type: 'received',
      notification: notification('b', 12),
    });

    expect(twice.items.map(({ id }) => id)).toEqual(['b', 'a']);
    expect(twice.pending).toEqual([]);
  });

  it('marca y desmarca como leídas', () => {
    const ready = notificationsReducer(loading, {
      type: 'load-success',
      requestId: 1,
      items: [notification('a', 8), notification('b', 9)],
    });

    const read = notificationsReducer(ready, { type: 'read', ids: ['a'] });
    expect(read.items.map(({ id, read: isRead }) => [id, isRead])).toEqual([
      ['b', false],
      ['a', true],
    ]);

    const reverted = notificationsReducer(read, { type: 'unread', ids: ['a'] });
    expect(reverted.items.every(({ read: isRead }) => !isRead)).toBe(true);
  });
});
