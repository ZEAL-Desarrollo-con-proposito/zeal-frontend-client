import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { ROLE_HOME_PATH } from '@/app/paths';
import { server } from '@/mocks/server';
import { readNotificationsDb } from '@/mocks/notifications/db';
import { freezeTime } from '@/test/clock';
import { storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import { MARK_ALL_READ_ENDPOINT, NOTIFICATIONS_ENDPOINT } from '../api/notificationsApi';

function openHome() {
  storeSession('EMPLEADO');
  return renderRoute(ROLE_HOME_PATH.EMPLEADO);
}

function bell() {
  return screen.getByRole('button', { name: /^Notificaciones/ });
}

async function bellWithUnread(count: number) {
  const label = count === 0 ? 'Notificaciones' : `Notificaciones, ${String(count)} sin leer`;
  return screen.findByRole('button', { name: label });
}

function panel() {
  return within(screen.getByRole('region', { name: 'Notificaciones' }));
}

function readStateOf(id: string) {
  return readNotificationsDb().notifications.find((notification) => notification.id === id)?.read;
}

describe('Campana de notificaciones (HU-FE-06)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('muestra cuántas notificaciones no leídas hay', async () => {
    openHome();

    const button = await bellWithUnread(1);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(within(button).getByText('1')).toBeInTheDocument();
  });

  it('abre la lista con las no leídas marcadas y cuándo llegaron', async () => {
    const { user } = openHome();
    await user.click(await bellWithUnread(1));

    expect(bell()).toHaveAttribute('aria-expanded', 'true');
    const items = panel().getAllByRole('button', { name: /Laura|bienvenida/ });
    expect(items[0]).toHaveTextContent('Laura Martínez abrió nuevos bloques');
    expect(items[0]).toHaveTextContent('Hace 2 h · No leída');
    expect(items[1]).toHaveTextContent('Te damos la bienvenida a ZEAL');
    expect(items[1]).toHaveTextContent('Hace 3 días');
    expect(items[1]).not.toHaveTextContent('No leída');
  });

  it('al abrir una notificación la marca como leída y lleva a su destino', async () => {
    const { router, user } = openHome();
    await user.click(await bellWithUnread(1));

    await user.click(panel().getByRole('button', { name: /Laura Martínez abrió nuevos bloques/ }));

    expect(router.state.location.pathname).toBe('/empleado/bienestar/psicologos/usr-psicologo-001');
    expect(await bellWithUnread(0)).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => {
      expect(readStateOf('notificacion-2')).toBe(true);
    });
  });

  it('abrir una ya leída solo lleva a su destino', async () => {
    const { router, user } = openHome();
    await user.click(await bellWithUnread(1));

    await user.click(panel().getByRole('button', { name: /Te damos la bienvenida a ZEAL/ }));

    expect(router.state.location.pathname).toBe('/empleado/bienestar');
    expect(await bellWithUnread(1)).toBeInTheDocument();
  });

  it('abrir una notificación sin destino la marca como leída sin cambiar de pantalla', async () => {
    server.use(
      http.get(`*${NOTIFICATIONS_ENDPOINT}`, () =>
        HttpResponse.json([
          {
            id: 'sin-enlace',
            type: 'AVISO',
            title: 'Recordatorio',
            message: 'Tu sesión de mañana es a las 9:00.',
            createdAt: new Date(2026, 8, 23, 9).toISOString(),
            read: false,
            link: null,
          },
        ]),
      ),
    );
    const { router, user } = openHome();
    await user.click(await bellWithUnread(1));

    await user.click(panel().getByRole('button', { name: /Recordatorio/ }));

    expect(router.state.location.pathname).toBe(ROLE_HOME_PATH.EMPLEADO);
    expect(await bellWithUnread(0)).toBeInTheDocument();
  });

  it('marca todas como leídas', async () => {
    const { user } = openHome();
    await user.click(await bellWithUnread(1));

    await user.click(panel().getByRole('button', { name: 'Marcar todas como leídas' }));

    expect(await bellWithUnread(0)).toBeInTheDocument();
    expect(panel().getByRole('button', { name: 'Marcar todas como leídas' })).toBeDisabled();
    await waitFor(() => {
      expect(readStateOf('notificacion-2')).toBe(true);
    });
  });

  it('si el servidor no guarda el cambio, lo deshace y avisa', async () => {
    server.use(
      http.post(`*${MARK_ALL_READ_ENDPOINT}`, () => new HttpResponse(null, { status: 500 }), {
        once: true,
      }),
    );
    const { user } = openHome();
    await user.click(await bellWithUnread(1));

    await user.click(panel().getByRole('button', { name: 'Marcar todas como leídas' }));

    expect(
      await within(screen.getByRole('region', { name: 'Avisos' })).findByText(
        'No pudimos marcar como leída',
      ),
    ).toBeInTheDocument();
    expect(await bellWithUnread(1)).toBeInTheDocument();
  });

  it('una notificación que ya no existe se da por leída', async () => {
    server.use(
      http.post(
        `*${NOTIFICATIONS_ENDPOINT}/:id/leida`,
        () => HttpResponse.json({ message: 'La notificación ya no existe' }, { status: 404 }),
        { once: true },
      ),
    );
    const { user } = openHome();
    await user.click(await bellWithUnread(1));

    await user.click(panel().getByRole('button', { name: /Laura Martínez abrió nuevos bloques/ }));

    expect(await bellWithUnread(0)).toBeInTheDocument();
    expect(screen.queryByText('No pudimos marcar como leída')).not.toBeInTheDocument();
  });

  it('se cierra con Escape (el foco vuelve a la campana), al tocar fuera o con la campana', async () => {
    const { user } = openHome();
    await user.click(await bellWithUnread(1));

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Notificaciones' })).not.toBeInTheDocument();
    });
    expect(bell()).toHaveFocus();

    await user.click(bell());
    fireEvent.pointerDown(panel().getByRole('heading', { name: 'Notificaciones' }));
    expect(screen.getByRole('region', { name: 'Notificaciones' })).toBeInTheDocument();
    await user.keyboard('a');
    expect(screen.getByRole('region', { name: 'Notificaciones' })).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Notificaciones' })).not.toBeInTheDocument();
    });

    await user.click(bell());
    await user.click(bell());
    await waitFor(() => {
      expect(bell()).toHaveAttribute('aria-expanded', 'false');
    });
  });

  it('muestra hasta "9+" en el contador', async () => {
    const many = Array.from({ length: 12 }, (_, index) => ({
      id: `n-${String(index)}`,
      type: 'AVISO',
      title: `Aviso ${String(index)}`,
      message: 'Mensaje',
      createdAt: new Date(2026, 8, 23, 8, index).toISOString(),
      read: false,
      link: null,
    }));
    server.use(http.get(`*${NOTIFICATIONS_ENDPOINT}`, () => HttpResponse.json(many)));
    openHome();

    const button = await bellWithUnread(12);
    expect(within(button).getByText('9+')).toBeInTheDocument();
  });

  it('avisa si no hay notificaciones', async () => {
    server.use(http.get(`*${NOTIFICATIONS_ENDPOINT}`, () => HttpResponse.json([])));
    const { user } = openHome();
    await user.click(await bellWithUnread(0));

    expect(panel().getByText('No tienes notificaciones.')).toBeInTheDocument();
  });

  it('muestra que carga y permite reintentar si falla', async () => {
    let release: () => void = () => undefined;
    server.use(
      http.get(
        `*${NOTIFICATIONS_ENDPOINT}`,
        async () => {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
          return new HttpResponse(null, { status: 500 });
        },
        { once: true },
      ),
    );
    const { user } = openHome();
    await user.click(bell());
    expect(panel().getByText('Cargando notificaciones…')).toBeInTheDocument();

    release();
    const alert = await panel().findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos cargar tus notificaciones.');
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(await panel().findByRole('button', { name: /Laura Martínez/ })).toBeInTheDocument();
  });
});
