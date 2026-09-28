import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { ROLE_HOME_PATH } from '@/app/paths';
import { notify } from '@/mocks/notifications/db';
import { publishToUser } from '@/mocks/realtime';
import { server } from '@/mocks/server';
import { freezeTime } from '@/test/clock';
import { buildSession, storeSession } from '@/test/credentials';
import type { RealtimeClient } from '@/shared/realtime/realtimeClient';
import { controlledRealtimeClient } from '@/test/realtime';
import { renderRoute } from '@/test/renderRoute';
import { MARK_ALL_READ_ENDPOINT, NOTIFICATIONS_ENDPOINT } from './api/notificationsApi';
import type { Notification } from './model/notification';
import { NOTIFICATIONS_QUEUE } from './model/notificationEvent';

const DAVID = 'usr-empleado-001';

const REMINDER = {
  type: 'RECORDATORIO',
  title: 'Tu sesión es mañana',
  message: 'Laura Martínez · 9:00 – 9:50',
  link: '/empleado/mis-citas',
} as const;

function openHome(realtimeFactory?: () => RealtimeClient) {
  storeSession('EMPLEADO');
  return renderRoute(ROLE_HOME_PATH.EMPLEADO, realtimeFactory);
}

async function bellWithUnread(count: number) {
  const name = count === 0 ? 'Notificaciones' : `Notificaciones, ${String(count)} sin leer`;
  return screen.findByRole('button', { name });
}

function toasts() {
  return within(screen.getByRole('region', { name: 'Avisos' }));
}

function liveNotification(id: string): Notification {
  return {
    id,
    type: 'RECORDATORIO',
    title: `Aviso ${id}`,
    message: 'Mensaje',
    createdAt: new Date(2026, 8, 23, 9, 15).toISOString(),
    read: false,
    link: null,
  };
}

describe('Notificaciones en tiempo real por la cola privada (HU-FE-06)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('una notificación nueva aparece al instante con un aviso y suma al contador', async () => {
    const { user } = openHome();
    await bellWithUnread(1);

    act(() => {
      notify(DAVID, REMINDER);
    });

    expect(await toasts().findByText('Tu sesión es mañana')).toBeInTheDocument();
    expect(toasts().getByRole('link', { name: 'Ver' })).toHaveAttribute(
      'href',
      '/empleado/mis-citas',
    );
    await user.click(await bellWithUnread(2));
    expect(
      within(screen.getByRole('region', { name: 'Notificaciones' })).getAllByRole('button', {
        name: /Tu sesión es mañana|Laura|bienvenida/,
      })[0],
    ).toHaveTextContent('Tu sesión es mañana');
  });

  it('solo recibe las suyas: la notificación de otra persona no llega', async () => {
    openHome();
    await bellWithUnread(1);

    act(() => {
      notify('usr-psicologo-001', { ...REMINDER, title: 'Para Laura' });
      notify(DAVID, REMINDER);
    });

    expect(await bellWithUnread(2)).toBeInTheDocument();
    expect(screen.queryByText('Para Laura')).not.toBeInTheDocument();
  });

  it('si la misma notificación llega dos veces, se anuncia y se cuenta una sola vez', async () => {
    openHome();
    await bellWithUnread(1);
    const event = { type: 'NUEVA', notification: liveNotification('repetida') };

    act(() => {
      publishToUser(DAVID, NOTIFICATIONS_QUEUE, event);
      publishToUser(DAVID, NOTIFICATIONS_QUEUE, event);
    });

    expect(await bellWithUnread(2)).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(toasts().getAllByText('Aviso repetida')).toHaveLength(1);
  });

  it('lo marcado como leído en otra pestaña se refleja al instante', async () => {
    openHome();
    await bellWithUnread(1);

    await act(() =>
      fetch(new URL(MARK_ALL_READ_ENDPOINT, window.location.origin), {
        method: 'POST',
        headers: { Authorization: `Bearer ${buildSession('EMPLEADO').accessToken}` },
      }),
    );

    expect(await bellWithUnread(0)).toBeInTheDocument();
  });

  it('no pierde una notificación que llega mientras se carga la lista', async () => {
    let release: () => void = () => undefined;
    server.use(
      http.get(
        `*${NOTIFICATIONS_ENDPOINT}`,
        async () => {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
          return HttpResponse.json([]);
        },
        { once: true },
      ),
    );
    openHome();
    await screen.findByRole('button', { name: 'Notificaciones' });

    act(() => {
      publishToUser(DAVID, NOTIFICATIONS_QUEUE, {
        type: 'NUEVA',
        notification: liveNotification('durante-la-carga'),
      });
    });
    expect(await toasts().findByText('Aviso durante-la-carga')).toBeInTheDocument();
    release();

    expect(await bellWithUnread(1)).toBeInTheDocument();
  });

  it('ignora mensajes mal formados en la cola', async () => {
    openHome();
    await bellWithUnread(1);

    act(() => {
      publishToUser(DAVID, NOTIFICATIONS_QUEUE, { type: 'BORRADA' });
      publishToUser(DAVID, NOTIFICATIONS_QUEUE, {
        type: 'NUEVA',
        notification: liveNotification('control'),
      });
    });

    expect(await bellWithUnread(2)).toBeInTheDocument();
  });

  it('al reconectarse recupera lo que llegó sin conexión', async () => {
    const { client, store } = controlledRealtimeClient();
    openHome(() => client);
    await bellWithUnread(1);

    act(() => {
      store.set('reconnecting');
    });
    // Sin conexión, la notificación nueva no llega por la cola.
    notify(DAVID, REMINDER);
    act(() => {
      store.set('connected');
    });

    await waitFor(async () => {
      expect(await bellWithUnread(2)).toBeInTheDocument();
    });
  });
});
