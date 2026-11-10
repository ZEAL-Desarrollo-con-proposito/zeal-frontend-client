import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { employeeRoomPath, EMPLOYEE_PATHS, PSYCHOLOGIST_PATHS, sessionRoomPath } from '@/app/paths';
import type { Role } from '@/features/auth/model/session';
import type {
  CallParticipant,
  VideoCallOptions,
  VideoCallSnapshot,
} from '@/features/videoCall/call/videoCall';
import { publishToUser } from '@/mocks/realtime';
import { server } from '@/mocks/server';
import { controlClock, freezeTime, jumpTo } from '@/test/clock';
import { buildSession, storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import { cancelReservationAt } from '@/test/wellbeing';
import { roomEndpoint } from './api/roomApi';
import { ROOMS_QUEUE } from './model/roomEvent';

/** Servidor de video simulado: la prueba decide cuándo conecta y quién está en la sala. */
const video = vi.hoisted(() => ({
  connect: vi.fn(),
  setMedia: vi.fn(),
  sendMessage: vi.fn(),
  leave: vi.fn(),
  options: null as VideoCallOptions | null,
}));

vi.mock('@/features/videoCall/call/liveKitVideoCall', () => ({
  connectLiveKit: (options: unknown) => video.connect(options) as unknown,
}));

// Miércoles 23 a las 9:20: reserva-16 (9:00 – 9:50, David con Laura) está en curso.
const RESERVATION = 'reserva-16';
const LAURA = 'usr-psicologo-001';
const DAVID = 'usr-empleado-001';
const wednesdayAt = (hour: number, minute = 0) => new Date(2026, 8, 23, hour, minute);

function person(fields: Partial<CallParticipant> & { id: string; name: string }): CallParticipant {
  return {
    host: false,
    self: false,
    stream: null,
    media: { audio: true, video: true },
    speaking: false,
    ...fields,
  };
}

const LAURA_SELF = person({ id: LAURA, name: 'Laura Martínez', self: true });
const DAVID_REMOTE = person({ id: DAVID, name: 'David Cajamarca' });

async function openAs(role: Role, path: string) {
  storeSession(role);
  return await renderRoute(path);
}

/** El psicólogo activa la sala desde otra pestaña (como lo haría con su cuenta). */
async function activateAsPsychologist(reservationId = RESERVATION) {
  await act(() =>
    fetch(new URL(`${roomEndpoint(reservationId)}/activar`, window.location.origin), {
      method: 'POST',
      headers: { Authorization: `Bearer ${buildSession('PSICOLOGO').accessToken}` },
    }),
  );
}

/** El servidor de video avisa un cambio en la sala. */
function serverSends(snapshot: VideoCallSnapshot) {
  act(() => {
    video.options?.onChange(snapshot);
  });
}

/** Espera a que la pantalla se conecte al servidor de video y le dice quién está en la sala. */
async function connectedWith(participants: CallParticipant[]) {
  await waitFor(() => {
    expect(video.options).not.toBeNull();
  });
  serverSends({ status: 'connected', participants });
  return await screen.findByRole('region', { name: 'Videollamada' });
}

function lobby() {
  return within(screen.getByRole('region', { name: 'Estado de la sala' }));
}

/** El aviso de la llamada: la región viva junto al video (el chat tiene la suya, de presencia). */
function callStatus() {
  const status = screen
    .getAllByRole('status')
    .find((element) => element.closest('aside') === null && element.closest('figure') === null);
  if (status === undefined) {
    throw new Error('No hay aviso de la llamada');
  }
  return status;
}

function callRegion() {
  return within(screen.getByRole('region', { name: 'Videollamada' }));
}

async function joinAsPsychologist() {
  const view = await openAs('PSICOLOGO', sessionRoomPath(RESERVATION));
  await view.user.click(await screen.findByRole('button', { name: 'Activar sala' }));
  await connectedWith([LAURA_SELF]);
  return view;
}

beforeEach(() => {
  video.options = null;
  video.connect.mockImplementation((options: VideoCallOptions) => {
    video.options = options;
    return Promise.resolve({
      setMedia: video.setMedia,
      sendMessage: video.sendMessage,
      leave: video.leave,
    });
  });
  video.setMedia.mockResolvedValue(undefined);
});

describe('Sala de la sesión · psicólogo (HU-FE-12, ADR-14)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('activa la sala y entra al video con el permiso que entrega el servidor', async () => {
    await joinAsPsychologist();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Sesión 1:1 · David Cajamarca' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Miércoles, 23 de septiembre · 9:00 – 9:50')).toBeInTheDocument();
    expect(screen.getByText('En curso')).toBeInTheDocument();
    expect(screen.getByText('Cifrado en tránsito · solo ustedes dos')).toBeInTheDocument();
    expect(document.title).toBe('Sala de sesión · ZEAL');
    expect(video.connect).toHaveBeenCalledWith(
      expect.objectContaining({
        serverUrl: `ws://${window.location.host}/livekit`,
        token: `token-de-${LAURA}-para-${RESERVATION}`,
      }),
    );
    // Al entrar se encienden el micrófono y la cámara.
    expect(video.setMedia).toHaveBeenCalledWith({ audio: true, video: true });
    expect(callStatus()).toHaveTextContent('Esperando a que David Cajamarca entre a la sala…');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Silenciar micrófono' })).toHaveFocus();
    });

    // El paciente entra con la cámara apagada.
    serverSends({
      status: 'connected',
      participants: [LAURA_SELF, { ...DAVID_REMOTE, media: { audio: true, video: false } }],
    });

    expect(callStatus()).toHaveTextContent('Conectado con David Cajamarca');
    expect(
      callRegion().getByRole('figure', { name: 'David Cajamarca, cámara apagada' }),
    ).toBeInTheDocument();
    expect(callRegion().getByRole('figure', { name: 'Tú' })).toBeInTheDocument();
  });

  it('los controles apagan y encienden el micrófono y la cámara', async () => {
    const { user } = await joinAsPsychologist();

    await user.click(screen.getByRole('button', { name: 'Silenciar micrófono' }));
    expect(video.setMedia).toHaveBeenLastCalledWith({ audio: false, video: true });
    await user.click(screen.getByRole('button', { name: 'Apagar cámara' }));
    expect(video.setMedia).toHaveBeenLastCalledWith({ audio: false, video: false });
    expect(
      callRegion().getByRole('figure', { name: 'Tú, micrófono silenciado, cámara apagada' }),
    ).toBeInTheDocument();
  });

  it('si el paciente sale, le avisa al instante y vuelve a esperarlo', async () => {
    await joinAsPsychologist();
    serverSends({ status: 'connected', participants: [LAURA_SELF, DAVID_REMOTE] });

    serverSends({ status: 'connected', participants: [LAURA_SELF] });

    expect(callStatus()).toHaveTextContent(
      'David Cajamarca salió de la sala. Puedes esperar a que vuelva o salir tú también.',
    );
    serverSends({ status: 'connected', participants: [LAURA_SELF, DAVID_REMOTE] });
    expect(callStatus()).toHaveTextContent('Conectado con David Cajamarca');
  });

  it('avisa si se pierde la conexión mientras se recupera', async () => {
    await joinAsPsychologist();

    serverSends({ status: 'reconnecting', participants: [LAURA_SELF, DAVID_REMOTE] });

    expect(callStatus()).toHaveTextContent('Se perdió la conexión. Reconectando…');
  });

  it('al salir deja la sala de video y vuelve a la agenda', async () => {
    const { user, router } = await joinAsPsychologist();

    await user.click(screen.getByRole('button', { name: 'Salir de la sala' }));

    expect(video.leave).toHaveBeenCalled();
    expect(router.state.location.pathname).toBe(PSYCHOLOGIST_PATHS.agenda);
  });

  it('si el servidor de video cierra la llamada, vuelve al vestíbulo para entrar de nuevo', async () => {
    const { user } = await joinAsPsychologist();

    serverSends({ status: 'ended', participants: [LAURA_SELF] });

    expect(await screen.findByRole('heading', { name: 'La sala está activa' })).toBeInTheDocument();
    await user.click(lobby().getByRole('button', { name: 'Volver a entrar' }));
    expect(video.connect).toHaveBeenCalledTimes(2);
  });

  it('si la sesión se cancela con la llamada abierta, la cierra', async () => {
    await joinAsPsychologist();

    cancelReservationAt(wednesdayAt(9));
    act(() => {
      publishToUser(LAURA, ROOMS_QUEUE, { type: 'SALA_ACTUALIZADA', reservationId: RESERVATION });
    });

    await waitFor(() => {
      expect(video.leave).toHaveBeenCalled();
    });
  });

  it('si no hay permiso para la cámara, se queda en la sala y explica cómo darlo', async () => {
    video.setMedia.mockRejectedValueOnce(new DOMException('denegado', 'NotAllowedError'));
    await joinAsPsychologist();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Permite el acceso a tu cámara y micrófono.',
    );
    expect(screen.getByRole('region', { name: 'Videollamada' })).toBeInTheDocument();
  });

  it('si el video no conecta, avisa y deja reintentar', async () => {
    video.connect.mockRejectedValueOnce(new Error('sin red'));
    const { user } = await openAs('PSICOLOGO', sessionRoomPath(RESERVATION));
    await user.click(await screen.findByRole('button', { name: 'Activar sala' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectar el video');
    await user.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(video.connect).toHaveBeenCalledTimes(2);
  });

  it('mientras conecta bloquea el botón', async () => {
    let connected: () => void = () => undefined;
    video.connect.mockImplementationOnce(
      (options: VideoCallOptions) =>
        new Promise((resolve) => {
          connected = () => {
            video.options = options;
            resolve({
              setMedia: video.setMedia,
              sendMessage: video.sendMessage,
              leave: video.leave,
            });
          };
        }),
    );
    await activateAsPsychologist();
    const { user } = await openAs('PSICOLOGO', sessionRoomPath(RESERVATION));

    await user.click(await screen.findByRole('button', { name: 'Entrar a la llamada' }));

    expect(lobby().getByRole('button', { name: 'Conectando…' })).toBeDisabled();
    await waitFor(() => {
      expect(video.connect).toHaveBeenCalled();
    });
    act(() => {
      connected();
    });
    expect(await connectedWith([LAURA_SELF])).toBeInTheDocument();
  });

  it('muestra el mensaje del servidor si no puede activar la sala', async () => {
    let answer: () => void = () => undefined;
    server.use(
      http.post(
        `*${roomEndpoint(RESERVATION)}/activar`,
        async () => {
          await new Promise<void>((resolve) => {
            answer = resolve;
          });
          return HttpResponse.json(
            { message: 'La sala de esta sesión ya cerró.' },
            { status: 409 },
          );
        },
        { once: true },
      ),
    );
    const { user } = await openAs('PSICOLOGO', sessionRoomPath(RESERVATION));

    await user.click(await screen.findByRole('button', { name: 'Activar sala' }));
    expect(lobby().getByRole('button', { name: 'Activando…' })).toBeDisabled();
    answer();

    expect(await screen.findByRole('alert')).toHaveTextContent('La sala de esta sesión ya cerró.');
    expect(video.connect).not.toHaveBeenCalled();
  });

  it('si la activa pero el servidor no entrega el permiso de video, no intenta conectar', async () => {
    server.use(
      http.post(
        `*${roomEndpoint(RESERVATION)}/activar`,
        () =>
          HttpResponse.json({
            reservationId: RESERVATION,
            status: 'ACTIVA',
            startsAt: wednesdayAt(9).toISOString(),
            endsAt: wednesdayAt(9, 50).toISOString(),
            opensAt: wednesdayAt(8, 50).toISOString(),
            closesAt: wednesdayAt(9, 50).toISOString(),
            participant: { id: DAVID, fullName: 'David Cajamarca' },
            connection: null,
          }),
        { once: true },
      ),
    );
    const { user } = await openAs('PSICOLOGO', sessionRoomPath(RESERVATION));

    await user.click(await screen.findByRole('button', { name: 'Activar sala' }));

    // Entrar habría cambiado el botón a "Conectando…": vuelve a "Activar sala" sin conectar.
    expect(await screen.findByRole('button', { name: 'Activar sala' })).toBeEnabled();
    expect(video.connect).not.toHaveBeenCalled();
  });

  it('si ya la activó (p. ej. recargó la página), ofrece volver a la llamada', async () => {
    await activateAsPsychologist();
    const { user } = await openAs('PSICOLOGO', sessionRoomPath(RESERVATION));

    expect(await screen.findByRole('heading', { name: 'La sala está activa' })).toBeInTheDocument();
    expect(
      lobby().getByText('Vuelve a entrar a la llamada con David Cajamarca.'),
    ).toBeInTheDocument();

    await user.click(lobby().getByRole('button', { name: 'Entrar a la llamada' }));
    expect(await connectedWith([LAURA_SELF])).toBeInTheDocument();
  });
});

describe('Chat dentro de la sesión 1:1', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('la conversación de Mensajes está al lado del video y se puede ocultar', async () => {
    const { user } = await joinAsPsychologist();

    const chat = within(screen.getByRole('complementary', { name: 'Chat de la sesión' }));
    expect(chat.getByRole('region', { name: 'Chat con David Cajamarca' })).toBeInTheDocument();
    await user.type(await chat.findByRole('textbox'), '¿Me escuchas bien?{Enter}');
    expect(await chat.findByText('¿Me escuchas bien?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ocultar chat' }));
    expect(
      screen.queryByRole('complementary', { name: 'Chat de la sesión' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mostrar chat' }));
    expect(screen.getByRole('complementary', { name: 'Chat de la sesión' })).toBeInTheDocument();
  });
});

describe('Sala de la sesión · vestíbulo', () => {
  it('antes de la hora dice cuándo abre, y se habilita y se cierra sola', async () => {
    controlClock(wednesdayAt(9, 55));
    await openAs('PSICOLOGO', sessionRoomPath('reserva-18'));

    expect(
      await screen.findByRole('heading', { name: 'La sala abre a las 10:50' }),
    ).toBeInTheDocument();
    expect(lobby().getByText(/Esta página se habilitará sola/)).toBeInTheDocument();
    expect(screen.getByText('Confirmada')).toBeInTheDocument();

    jumpTo(wednesdayAt(10, 50));
    expect(
      await screen.findByRole('heading', { name: 'Activa la sala para empezar' }),
    ).toBeInTheDocument();

    jumpTo(wednesdayAt(11, 50));
    expect(await screen.findByRole('heading', { name: 'La sala ya cerró' })).toBeInTheDocument();
    expect(lobby().getByText('La ventana para entrar a esta sesión terminó.')).toBeInTheDocument();
  });

  it.each([
    ['reserva-7', 'Esta sesión fue cancelada', 'Cancelada'],
    ['reserva-15', 'Esta sesión ya finalizó', 'Finalizada'],
  ])('no ofrece videollamada para %s: "%s"', async (id, title, badge) => {
    freezeTime();
    await openAs('PSICOLOGO', sessionRoomPath(id));

    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByText(badge)).toBeInTheDocument();
    expect(lobby().getByText('No hay una sala abierta para esta reserva.')).toBeInTheDocument();
  });

  it('se entera al instante si el paciente cancela mientras se espera', async () => {
    freezeTime();
    await openAs('PSICOLOGO', sessionRoomPath('reserva-18'));
    await screen.findByRole('heading', { name: 'La sala abre a las 10:50' });

    cancelReservationAt(wednesdayAt(11));
    act(() => {
      publishToUser(LAURA, ROOMS_QUEUE, { type: 'SALA_ACTUALIZADA', reservationId: 'reserva-18' });
    });

    expect(
      await screen.findByRole('heading', { name: 'Esta sesión fue cancelada' }),
    ).toBeInTheDocument();
  });

  it('muestra que carga y, si la sesión no existe o no es propia, permite volver', async () => {
    freezeTime();
    const { router, user } = await openAs('PSICOLOGO', sessionRoomPath('reserva-999'));

    expect(screen.getByRole('heading', { level: 1, name: 'Sala de sesión' })).toBeInTheDocument();
    expect(screen.getByText('Cargando la sesión…')).toHaveAttribute('aria-busy', 'true');
    expect(
      await screen.findByRole('heading', { name: 'No encontramos esta sesión' }),
    ).toBeInTheDocument();

    await user.click(
      within(screen.getByRole('main')).getByRole('link', { name: 'Volver a mi agenda' }),
    );
    expect(router.state.location.pathname).toBe(PSYCHOLOGIST_PATHS.agenda);
  });

  it('permite reintentar si la sala no carga', async () => {
    freezeTime();
    server.use(
      http.get(`*${roomEndpoint(RESERVATION)}`, () => new HttpResponse(null, { status: 500 }), {
        once: true,
      }),
    );
    const { user } = await openAs('PSICOLOGO', sessionRoomPath(RESERVATION));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos abrir la sala');
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(
      await screen.findByRole('heading', { name: 'Activa la sala para empezar' }),
    ).toBeInTheDocument();
  });
});

describe('Sala de la sesión · empleado (HU-FE-12, ADR-14)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('espera a que la psicóloga active la sala y entra en cuanto lo hace, sin recargar', async () => {
    const { user } = await openAs('EMPLEADO', employeeRoomPath(RESERVATION));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sesión 1:1 · Laura Martínez' }),
    ).toBeInTheDocument();
    expect(
      lobby().getByRole('heading', { name: 'Esperando a Laura Martínez' }),
    ).toBeInTheDocument();
    expect(lobby().queryByRole('button')).not.toBeInTheDocument();

    await activateAsPsychologist();

    expect(await screen.findByRole('heading', { name: 'La sala está lista' })).toBeInTheDocument();
    await user.click(lobby().getByRole('button', { name: 'Entrar a la llamada' }));

    await connectedWith([
      person({ id: DAVID, name: 'David Cajamarca', self: true }),
      person({ id: LAURA, name: 'Laura Martínez', media: { audio: true, video: false } }),
    ]);
    // Su permiso de video es suyo: el servidor lo firma para el empleado y esta sesión.
    expect(video.connect).toHaveBeenCalledWith(
      expect.objectContaining({ token: `token-de-${DAVID}-para-${RESERVATION}` }),
    );
    expect(
      callRegion().getByRole('figure', { name: 'Laura Martínez, cámara apagada' }),
    ).toBeInTheDocument();
  });

  it('vuelve a sus citas al salir', async () => {
    await activateAsPsychologist();
    const { user, router } = await openAs('EMPLEADO', employeeRoomPath(RESERVATION));
    await user.click(await screen.findByRole('button', { name: 'Entrar a la llamada' }));
    await connectedWith([person({ id: DAVID, name: 'David Cajamarca', self: true })]);
    // El empleado ve la misma conversación con su psicóloga dentro de la llamada.
    expect(
      await screen.findByRole('region', { name: 'Chat con Laura Martínez' }),
    ).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Salir de la sala' }));

    expect(router.state.location.pathname).toBe(EMPLOYEE_PATHS.appointments);
  });
});
