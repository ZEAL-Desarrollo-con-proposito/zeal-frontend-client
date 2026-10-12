import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_PATHS, EMPLOYEE_PATHS, workshopRoomPath } from '@/app/paths';
import type { Role } from '@/features/auth/model/session';
import { SEED_ORGANIZATION } from '@/mocks/seedUsers';
import { server } from '@/mocks/server';
import type { WorkshopRecord } from '@/mocks/workshops/db';
import { readWorkshopsDb, writeWorkshopsDb } from '@/mocks/workshops/db';
import { controlClock, freezeTime, jumpTo } from '@/test/clock';
import { storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import { workshopRoomEndpoint } from './api/workshopRoomApi';
import type { GroupCallOptions, GroupCallSnapshot, GroupParticipant } from './call/groupCall';

/** Servidor de video simulado: la prueba decide cuándo conecta y qué personas hay en la sala. */
const video = vi.hoisted(() => ({
  connect: vi.fn(),
  setMedia: vi.fn(),
  leave: vi.fn(),
  options: null as GroupCallOptions | null,
}));

vi.mock('./call/liveKitGroupCall', () => ({
  connectLiveKit: (options: unknown) => video.connect(options) as unknown,
}));

// Miércoles 23 a las 9:20. "En vivo" empieza a las 9:25 (su sala abrió a las 9:15).
const LIVE = 'taller-en-vivo';
const LIVE_TITLE = 'Respiración consciente en vivo';
const LATER = 'taller-mas-tarde';
const LATER_TITLE = 'Límites sanos al final del día';
const DONE = 'taller-de-la-manana';
const DAVID = 'usr-empleado-001';
const wednesdayAt = (hour: number, minute = 0) => new Date(2026, 8, 23, hour, minute);

function workshop(id: string, title: string, startsAt: Date, durationMinutes = 60): WorkshopRecord {
  return {
    id,
    title,
    description: 'Un taller para cuidar la energía del equipo durante la semana.',
    startsAt: startsAt.toISOString(),
    durationMinutes,
    capacity: 20,
    occupied: 3,
    version: 1,
    publishedAt: wednesdayAt(8).toISOString(),
    organization: SEED_ORGANIZATION,
  };
}

/** Talleres de la prueba, con David inscrito en todos. */
function seedWorkshops() {
  const db = readWorkshopsDb();
  const added = [
    workshop(LIVE, LIVE_TITLE, wednesdayAt(9, 25)),
    workshop(LATER, LATER_TITLE, wednesdayAt(11)),
    workshop(DONE, 'Pausas activas de la mañana', wednesdayAt(7), 60),
  ];
  db.workshops.push(...added);
  for (const { id } of added) {
    db.sequence += 1;
    db.enrollments.push({
      id: `inscripcion-${String(db.sequence)}`,
      workshopId: id,
      userId: DAVID,
      createdAt: wednesdayAt(8).toISOString(),
      version: 1,
    });
  }
  writeWorkshopsDb(db);
}

function person(
  fields: Partial<GroupParticipant> & { id: string; name: string },
): GroupParticipant {
  return {
    host: false,
    self: false,
    stream: null,
    media: { audio: true, video: true },
    speaking: false,
    ...fields,
  };
}

const SELF = person({ id: DAVID, name: 'David Cajamarca', self: true });
const HOST = person({ id: 'usr-admin-001', name: 'Talento Humano', host: true, speaking: true });
const MARIANA = person({
  id: 'usr-empleado-002',
  name: 'Mariana Torres',
  media: { audio: false, video: false },
});

/** El servidor de video avisa un cambio en la sala. */
function serverSends(snapshot: GroupCallSnapshot) {
  act(() => {
    video.options?.onChange(snapshot);
  });
}

function openAs(role: Role, path: string) {
  storeSession(role);
  return renderRoute(path);
}

function lobby() {
  return within(screen.getByRole('region', { name: 'Estado de la sala' }));
}

/**
 * Espera el botón de entrada de la sala. Se busca en toda la pantalla: el recuadro de la sala se
 * vuelve a montar cada vez que cambia de estado.
 */
function joinButton(name = 'Entrar a la sala') {
  return screen.findByRole('button', { name });
}

function live() {
  return within(screen.getByRole('region', { name: 'Taller en vivo' }));
}

beforeEach(() => {
  video.options = null;
  video.setMedia.mockResolvedValue(undefined);
  video.connect.mockImplementation((options: GroupCallOptions) => {
    video.options = options;
    return Promise.resolve({ setMedia: video.setMedia, leave: video.leave });
  });
});

describe('Sala del taller (videollamada grupal)', () => {
  beforeEach(() => {
    freezeTime(wednesdayAt(9, 20));
    seedWorkshops();
  });

  it('la persona inscrita entra desde Mis talleres, ve a todos y controla su micrófono y cámara', async () => {
    const { user, router } = openAs('EMPLEADO', EMPLOYEE_PATHS.myWorkshops);

    await user.click(
      await screen.findByRole('link', { name: `Entrar a la sala de ${LIVE_TITLE}` }),
    );
    // Solo el taller cuya sala está abierta tiene entrada.
    expect(router.state.location.pathname).toBe(workshopRoomPath('EMPLEADO', LIVE));
    expect(await screen.findByText('Participante')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: `Taller · ${LIVE_TITLE}` })).toBeInTheDocument();
    expect(lobby().getByText(/se encenderán tu cámara y tu micrófono/)).toBeInTheDocument();

    await user.click(lobby().getByRole('button', { name: 'Entrar a la sala' }));

    await waitFor(() => {
      expect(video.connect).toHaveBeenCalledTimes(1);
    });
    expect(video.options?.serverUrl).toMatch(/^ws:\/\/.+\/livekit$/);
    expect(video.options?.token).toBe(`token-de-${DAVID}-para-${LIVE}`);
    serverSends({ status: 'connected', participants: [SELF, HOST, MARIANA] });

    expect(await live().findByText('3 personas en la sala')).toBeInTheDocument();
    expect(video.setMedia).toHaveBeenCalledWith({ audio: true, video: true });
    const grid = within(live().getByRole('list', { name: 'Participantes' }));
    expect(grid.getByRole('figure', { name: 'Tú' })).toBeInTheDocument();
    expect(grid.getByRole('figure', { name: 'Talento Humano · Anfitrión' })).toBeInTheDocument();
    expect(
      grid.getByRole('figure', {
        name: 'Mariana Torres, micrófono silenciado, cámara apagada',
      }),
    ).toBeInTheDocument();

    await user.click(live().getByRole('button', { name: 'Silenciar micrófono' }));
    expect(video.setMedia).toHaveBeenLastCalledWith({ audio: false, video: true });
    expect(live().getByRole('button', { name: 'Silenciar micrófono' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(live().getByRole('button', { name: 'Apagar cámara' }));
    expect(video.setMedia).toHaveBeenLastCalledWith({ audio: false, video: false });

    await user.click(live().getByRole('button', { name: 'Salir de la sala' }));
    expect(video.leave).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe(EMPLOYEE_PATHS.myWorkshops);
  });

  it('la empresa anfitriona abre la sala desde su panel de talleres', async () => {
    const { user } = openAs('ADMIN', ADMIN_PATHS.workshops);

    await user.click(await screen.findByRole('link', { name: `Abrir la sala de ${LIVE_TITLE}` }));

    expect(await screen.findByText('Anfitrión')).toBeInTheDocument();
    expect(lobby().getByText(/recibir a las 3 personas inscritas/)).toBeInTheDocument();
    await user.click(lobby().getByRole('button', { name: 'Entrar a la sala' }));
    await waitFor(() => {
      expect(video.options?.token).toBe(`token-de-usr-admin-001-para-${LIVE}`);
    });
    serverSends({ status: 'connected', participants: [{ ...HOST, self: true }] });
    expect(await live().findByText('1 persona en la sala')).toBeInTheDocument();
    expect(live().getByRole('figure', { name: 'Tú · Anfitrión' })).toBeInTheDocument();
  });

  it('un taller que ya terminó no tiene sala', async () => {
    openAs('EMPLEADO', workshopRoomPath('EMPLEADO', DONE));

    expect(await screen.findByText('Este taller ya terminó')).toBeInTheDocument();
    expect(lobby().queryByRole('button')).not.toBeInTheDocument();
  });

  it('quien no está inscrito no encuentra la sala', async () => {
    const db = readWorkshopsDb();
    writeWorkshopsDb({ ...db, enrollments: [] });
    const { user, router } = openAs('EMPLEADO', workshopRoomPath('EMPLEADO', LIVE));

    expect(await screen.findByText('No encontramos esta sala')).toBeInTheDocument();
    // La flecha del encabezado solo tiene aria-label; el botón del mensaje muestra el texto.
    await user.click(screen.getByText('Volver a mis talleres'));
    expect(router.state.location.pathname).toBe(EMPLOYEE_PATHS.myWorkshops);
  });

  it('si la sala no carga se puede reintentar', async () => {
    server.use(
      http.get(`*${workshopRoomEndpoint(LIVE)}`, () => HttpResponse.json({}, { status: 500 }), {
        once: true,
      }),
    );
    const { user } = openAs('EMPLEADO', workshopRoomPath('EMPLEADO', LIVE));

    expect(screen.getByText('Cargando la sala…')).toBeInTheDocument();
    expect(await screen.findByText('No pudimos abrir la sala')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('La sala del taller está abierta')).toBeInTheDocument();
  });

  it('si el video no conecta, avisa y deja reintentar', async () => {
    video.connect.mockRejectedValueOnce(new Error('sin red'));
    const { user } = openAs('EMPLEADO', workshopRoomPath('EMPLEADO', LIVE));

    await user.click(await joinButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectar el video');
    await user.click(lobby().getByRole('button', { name: 'Reintentar' }));
    serverSends({ status: 'connected', participants: [SELF] });
    expect(await live().findByText('1 persona en la sala')).toBeInTheDocument();
  });

  it('mientras conecta no se puede volver a pulsar; los controles esperan a la conexión', async () => {
    let finish: () => void = () => undefined;
    video.connect.mockImplementation((options: GroupCallOptions) => {
      video.options = options;
      // El servidor avisa quién está antes de terminar de conectar.
      options.onChange({ status: 'connected', participants: [SELF] });
      return new Promise((resolve) => {
        finish = () => {
          resolve({ setMedia: video.setMedia, leave: video.leave });
        };
      });
    });
    const { user, router } = openAs('EMPLEADO', workshopRoomPath('EMPLEADO', LIVE));

    await user.click(await joinButton());

    await user.click(await live().findByRole('button', { name: 'Silenciar micrófono' }));
    expect(video.setMedia).not.toHaveBeenCalled();
    await user.click(live().getByRole('button', { name: 'Salir de la sala' }));
    expect(video.leave).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe(EMPLOYEE_PATHS.myWorkshops);
    act(() => {
      finish();
    });
  });

  it('muestra "Conectando…" mientras el servidor de video responde', async () => {
    video.connect.mockReturnValue(new Promise(() => undefined));
    const { user } = openAs('EMPLEADO', workshopRoomPath('EMPLEADO', LIVE));

    await user.click(await joinButton());

    expect(lobby().getByRole('button', { name: 'Conectando…' })).toBeDisabled();
  });

  it('si el navegador bloquea la cámara, la persona sigue en la sala y sabe cómo dar el permiso', async () => {
    video.setMedia.mockRejectedValueOnce(new DOMException('Permiso denegado', 'NotAllowedError'));
    const { user } = openAs('EMPLEADO', workshopRoomPath('EMPLEADO', LIVE));

    await user.click(await joinButton());
    serverSends({ status: 'connected', participants: [SELF, HOST] });

    expect(await live().findByRole('alert')).toHaveTextContent(
      'Permite el acceso a tu cámara y micrófono',
    );
    expect(live().getByRole('button', { name: 'Apagar cámara' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(live().getByRole('button', { name: 'Apagar cámara' }));
    expect(video.setMedia).toHaveBeenLastCalledWith({ audio: false, video: true });
    await waitFor(() => {
      expect(live().queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('avisa la reconexión y, si el servidor cierra la llamada, permite volver a entrar', async () => {
    const { user } = openAs('EMPLEADO', workshopRoomPath('EMPLEADO', LIVE));

    await user.click(await joinButton());
    serverSends({ status: 'reconnecting', participants: [SELF] });
    expect(await live().findByText('Se perdió la conexión. Reconectando…')).toBeInTheDocument();

    serverSends({ status: 'ended', participants: [] });
    expect(await joinButton('Volver a entrar')).toBeInTheDocument();
  });

  it('al cerrar la página se sale de la llamada', async () => {
    const { user, unmount } = openAs('EMPLEADO', workshopRoomPath('EMPLEADO', LIVE));
    await user.click(await joinButton());
    serverSends({ status: 'connected', participants: [SELF] });
    await live().findByText('1 persona en la sala');

    unmount();

    expect(video.leave).toHaveBeenCalledTimes(1);
  });
});

describe('La sala abre y cierra sola con el reloj', () => {
  beforeEach(() => {
    controlClock(wednesdayAt(9, 20));
    seedWorkshops();
  });

  it('antes de la hora muestra cuándo abre y se habilita sin recargar', async () => {
    openAs('EMPLEADO', workshopRoomPath('EMPLEADO', LATER));

    expect(await screen.findByText('La sala abre a las 10:50')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Entrar a la sala' })).not.toBeInTheDocument();

    jumpTo(wednesdayAt(10, 50));

    expect(await joinButton()).toBeInTheDocument();
  });

  it('cuando el taller termina, la llamada se cierra', async () => {
    const { user } = openAs('EMPLEADO', workshopRoomPath('EMPLEADO', LIVE));
    await user.click(await joinButton());
    serverSends({ status: 'connected', participants: [SELF, HOST] });
    await live().findByText('2 personas en la sala');

    jumpTo(wednesdayAt(10, 25));

    expect(await screen.findByText('Este taller ya terminó')).toBeInTheDocument();
    expect(video.leave).toHaveBeenCalled();
  });

  it('Mis talleres muestra la entrada solo mientras la sala está abierta', async () => {
    openAs('EMPLEADO', EMPLOYEE_PATHS.myWorkshops);

    expect(
      await screen.findByRole('link', { name: `Entrar a la sala de ${LIVE_TITLE}` }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: `Entrar a la sala de ${LATER_TITLE}` }),
    ).not.toBeInTheDocument();
  });
});
