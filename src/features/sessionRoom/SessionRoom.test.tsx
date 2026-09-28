import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, onTestFinished } from 'vitest';
import { employeeRoomPath, EMPLOYEE_PATHS, PSYCHOLOGIST_PATHS, sessionRoomPath } from '@/app/paths';
import type { Role } from '@/features/auth/model/session';
import { createMockRealtimeClient, publishToUser } from '@/mocks/realtime';
import { server } from '@/mocks/server';
import { handleRoomMessage } from '@/mocks/wellbeing/roomHandlers';
import type { RealtimeClient } from '@/shared/realtime/realtimeClient';
import { createStatusStore } from '@/shared/realtime/realtimeClient';
import { controlClock, freezeTime, jumpTo } from '@/test/clock';
import { buildSession, storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import { cancelReservationAt } from '@/test/wellbeing';
import { asMediaStream, FakeStream, installCamera, installPeerConnection } from '@/test/webrtc';
import { roomEndpoint } from './api/roomApi';
import type { Signal } from './model/roomEvent';
import { isRoomEvent, ROOMS_QUEUE, signalDestination } from './model/roomEvent';

// Miércoles 23 a las 9:20: reserva-16 (9:00 – 9:50, David con Laura) está en curso.
const RESERVATION = 'reserva-16';
const LAURA = 'usr-psicologo-001';
const wednesdayAt = (hour: number, minute = 0) => new Date(2026, 8, 23, hour, minute);

function openAs(role: Role, path: string, realtimeFactory?: (token: string) => RealtimeClient) {
  storeSession(role);
  return renderRoute(path, realtimeFactory);
}

/** La otra persona de la llamada, conectada al Real-Time Gateway simulado con su propia sesión. */
function counterpart(role: Role, reservationId = RESERVATION) {
  const client = createMockRealtimeClient(buildSession(role).accessToken, handleRoomMessage);
  client.connect();
  onTestFinished(() => {
    client.disconnect();
  });
  const received: Signal[] = [];
  client.subscribe(ROOMS_QUEUE, (payload) => {
    if (isRoomEvent(payload) && payload.type === 'SENAL') {
      received.push(payload.signal);
    }
  });
  return {
    received,
    send(signal: Signal) {
      act(() => {
        client.publish(signalDestination(reservationId), signal);
      });
    },
    /** Espera la `count`-ésima señal de ese tipo que le llegó. */
    async next<T extends Signal['type']>(
      type: T,
      count = 1,
    ): Promise<Extract<Signal, { type: T }>> {
      let found: Signal | undefined;
      await waitFor(() => {
        found = received.filter((signal) => signal.type === type)[count - 1];
        expect(found).toBeDefined();
      });
      return found as Extract<Signal, { type: T }>;
    },
  };
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

function lobby() {
  return within(screen.getByRole('region', { name: 'Estado de la sala' }));
}

function callRegion() {
  return within(screen.getByRole('region', { name: 'Videollamada' }));
}

function videoOf(name: string): HTMLVideoElement {
  const video = callRegion()
    .getByRole('figure', { name: new RegExp(`^${name}`) })
    .querySelector('video');
  if (video === null) {
    throw new Error(`No hay video de ${name}`);
  }
  return video;
}

async function joinAsPsychologist() {
  const camera = installCamera();
  const peers = installPeerConnection();
  const david = counterpart('EMPLEADO');
  const view = openAs('PSICOLOGO', sessionRoomPath(RESERVATION));
  await view.user.click(await screen.findByRole('button', { name: 'Activar sala' }));
  await screen.findByRole('region', { name: 'Videollamada' });
  const [local] = camera.granted;
  if (local === undefined) {
    throw new Error('La cámara no se encendió');
  }
  return { ...view, camera, peers, david, local };
}

describe('Sala de la sesión · psicólogo (HU-FE-12)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('activa la sala, entra a la llamada y conecta el video con el paciente', async () => {
    const { david, peers, camera } = await joinAsPsychologist();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Sesión 1:1 · David Cajamarca' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Miércoles, 23 de septiembre · 9:00 – 9:50')).toBeInTheDocument();
    expect(screen.getByText('En curso')).toBeInTheDocument();
    expect(document.title).toBe('Sala de sesión · ZEAL');
    expect(camera.getUserMedia).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Esperando a que David Cajamarca entre a la sala…',
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Silenciar micrófono' })).toHaveFocus();
    });

    // El paciente entra: se negocia el video por el Real-Time Gateway.
    await david.next('LISTO');
    david.send({ type: 'LISTO', media: { audio: true, video: true } });
    const offer = await david.next('OFERTA');
    david.send({ type: 'RESPUESTA', id: offer.id, sdp: 'respuesta-de-david' });
    await waitFor(() => {
      expect(peers.last().remoteDescription).toEqual({ type: 'answer', sdp: 'respuesta-de-david' });
    });

    const remote = asMediaStream(new FakeStream());
    act(() => {
      peers.last().emitCandidate({ candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0 });
      peers.last().emitTrack([remote]);
      peers.last().setState('connected');
    });

    expect(await david.next('CANDIDATO')).toMatchObject({ id: offer.id });
    expect(await screen.findByText('Conectado con David Cajamarca')).toBeInTheDocument();
    expect(videoOf('David Cajamarca').srcObject).toBe(remote);
    expect(peers.last().tracks).toHaveLength(2);

    act(() => {
      peers.last().setState('disconnected');
    });
    expect(await screen.findByText('Se perdió la conexión. Reconectando…')).toBeInTheDocument();
  });

  it('los controles apagan el micrófono y la cámara, y la otra persona se entera', async () => {
    const { user, david, local } = await joinAsPsychologist();
    const microphone = screen.getByRole('button', { name: 'Silenciar micrófono' });
    const camera = screen.getByRole('button', { name: 'Apagar cámara' });

    await user.click(microphone);
    await user.click(camera);

    expect(microphone).toHaveAttribute('aria-pressed', 'true');
    expect(camera).toHaveAttribute('aria-pressed', 'true');
    expect(local.track('audio').enabled).toBe(false);
    expect(local.track('video').enabled).toBe(false);
    expect(await david.next('MEDIOS', 2)).toEqual({
      type: 'MEDIOS',
      media: { audio: false, video: false },
    });
    const own = callRegion().getByRole('figure', { name: /^Tú/ });
    expect(own).toHaveTextContent('Tú, micrófono silenciado, cámara apagada');
    expect(within(own).getByRole('img', { name: 'Laura Martínez' })).toBeInTheDocument();

    await user.click(microphone);
    expect(microphone).toHaveAttribute('aria-pressed', 'false');
    expect(local.track('audio').enabled).toBe(true);

    david.send({ type: 'MEDIOS', media: { audio: false, video: false } });
    expect(
      await callRegion().findByRole('figure', {
        name: 'David Cajamarca, micrófono silenciado, cámara apagada',
      }),
    ).toBeInTheDocument();
  });

  it('si el paciente sale, vuelve a esperarlo', async () => {
    const { david } = await joinAsPsychologist();
    await david.next('LISTO');
    david.send({ type: 'LISTO', media: { audio: true, video: true } });
    await david.next('OFERTA');

    david.send({ type: 'SALIO' });

    expect(
      await screen.findByText('Esperando a que David Cajamarca entre a la sala…'),
    ).toBeInTheDocument();
  });

  it('al salir apaga la cámara, avisa al paciente y vuelve a la agenda', async () => {
    const { user, router, david, local } = await joinAsPsychologist();

    await user.click(screen.getByRole('button', { name: 'Salir de la sala' }));

    expect(router.state.location.pathname).toBe(PSYCHOLOGIST_PATHS.agenda);
    expect(local.getTracks().map((track) => track.readyState)).toEqual(['ended', 'ended']);
    expect(await david.next('SALIO')).toEqual({ type: 'SALIO' });
  });

  it('al recuperar la conexión con ZEAL vuelve a saludar para renegociar el video', async () => {
    installCamera();
    installPeerConnection();
    const david = counterpart('EMPLEADO');
    const store = createStatusStore();
    const factory = (token: string): RealtimeClient => {
      const inner = createMockRealtimeClient(token, handleRoomMessage);
      return {
        ...inner,
        connect: () => {
          inner.connect();
          store.set('connected');
        },
        getStatus: store.getStatus,
        getRecoveries: store.getRecoveries,
        onChange: store.onChange,
      };
    };
    const { user } = openAs('PSICOLOGO', sessionRoomPath(RESERVATION), factory);
    await user.click(await screen.findByRole('button', { name: 'Activar sala' }));
    await david.next('LISTO');

    act(() => {
      store.set('reconnecting');
    });
    act(() => {
      store.set('connected');
    });

    expect(await david.next('LISTO', 2)).toMatchObject({ type: 'LISTO' });
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
    const { user } = openAs('PSICOLOGO', sessionRoomPath(RESERVATION));

    await user.click(await screen.findByRole('button', { name: 'Activar sala' }));
    expect(lobby().getByRole('button', { name: 'Activando…' })).toBeDisabled();
    answer();

    expect(await screen.findByRole('alert')).toHaveTextContent('La sala de esta sesión ya cerró.');
    expect(lobby().getByRole('button', { name: 'Activar sala' })).toBeEnabled();
  });

  it('si no hay permiso para la cámara, explica cómo darlo y deja reintentar', async () => {
    installCamera(new DOMException('Permiso denegado', 'NotAllowedError'));
    installPeerConnection();
    const { user } = openAs('PSICOLOGO', sessionRoomPath(RESERVATION));

    await user.click(await screen.findByRole('button', { name: 'Activar sala' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Permite el acceso a tu cámara y micrófono.');
    expect(alert).toHaveTextContent('Actívalo desde el candado de la barra de direcciones');

    installCamera();
    await user.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('region', { name: 'Videollamada' })).toBeInTheDocument();
  });

  it('mientras enciende la cámara bloquea el botón; si se va antes, la apaga igual', async () => {
    const camera = installCamera('pending');
    installPeerConnection();
    const { user, router } = openAs('PSICOLOGO', sessionRoomPath(RESERVATION));
    await user.click(await screen.findByRole('button', { name: 'Activar sala' }));
    expect(await screen.findByRole('button', { name: 'Encendiendo tu cámara…' })).toBeDisabled();

    await user.click(screen.getByRole('link', { name: 'Volver a mi agenda' }));
    expect(router.state.location.pathname).toBe(PSYCHOLOGIST_PATHS.agenda);
    await act(async () => {
      camera.release('ok');
      await Promise.resolve();
    });

    expect(camera.granted[0]?.getTracks().map((track) => track.readyState)).toEqual([
      'ended',
      'ended',
    ]);
  });

  it('un permiso que llega tarde, cuando ya salió, se ignora', async () => {
    const camera = installCamera('pending');
    installPeerConnection();
    const { user } = openAs('PSICOLOGO', sessionRoomPath(RESERVATION));
    await user.click(await screen.findByRole('button', { name: 'Activar sala' }));
    await screen.findByRole('button', { name: 'Encendiendo tu cámara…' });
    await user.click(screen.getByRole('link', { name: 'Volver a mi agenda' }));

    await act(async () => {
      camera.release(new DOMException('Permiso denegado', 'NotAllowedError'));
      await Promise.resolve();
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('si ya la activó (p. ej. recargó la página), ofrece volver a la llamada', async () => {
    installCamera();
    installPeerConnection();
    await activateAsPsychologist();
    const { user } = openAs('PSICOLOGO', sessionRoomPath(RESERVATION));

    expect(await screen.findByRole('heading', { name: 'La sala está activa' })).toBeInTheDocument();
    expect(
      lobby().getByText('Vuelve a entrar a la llamada con David Cajamarca.'),
    ).toBeInTheDocument();

    await user.click(lobby().getByRole('button', { name: 'Entrar a la llamada' }));
    expect(await screen.findByRole('region', { name: 'Videollamada' })).toBeInTheDocument();
  });
});

describe('Sala de la sesión · vestíbulo', () => {
  it('antes de la hora dice cuándo abre, y se habilita y se cierra sola', async () => {
    controlClock(wednesdayAt(9, 55));
    openAs('PSICOLOGO', sessionRoomPath('reserva-18'));

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
    openAs('PSICOLOGO', sessionRoomPath(id));

    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByText(badge)).toBeInTheDocument();
    expect(lobby().getByText('No hay una sala abierta para esta reserva.')).toBeInTheDocument();
  });

  it('se entera al instante si el paciente cancela mientras se espera', async () => {
    freezeTime();
    openAs('PSICOLOGO', sessionRoomPath('reserva-18'));
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
    const { router, user } = openAs('PSICOLOGO', sessionRoomPath('reserva-999'));

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
    const { user } = openAs('PSICOLOGO', sessionRoomPath(RESERVATION));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos abrir la sala');
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(
      await screen.findByRole('heading', { name: 'Activa la sala para empezar' }),
    ).toBeInTheDocument();
  });
});

describe('Sala de la sesión · empleado (HU-FE-12)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('espera a que la psicóloga active la sala y entra en cuanto lo hace, sin recargar', async () => {
    const camera = installCamera('pending');
    const peers = installPeerConnection();
    const laura = counterpart('PSICOLOGO');
    const { user } = openAs('EMPLEADO', employeeRoomPath(RESERVATION));

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
    expect(lobby().getByRole('button', { name: 'Encendiendo tu cámara…' })).toBeDisabled();
    await act(async () => {
      camera.release('ok');
      await Promise.resolve();
    });
    await screen.findByRole('region', { name: 'Videollamada' });

    // Laura ya estaba: saluda, el empleado confirma y responde su oferta.
    expect(await laura.next('LISTO')).toMatchObject({ media: { audio: true, video: true } });
    laura.send({ type: 'LISTO', media: { audio: true, video: false } });
    expect(await laura.next('LISTO', 2)).toMatchObject({ type: 'LISTO' });
    laura.send({ type: 'OFERTA', id: 'n-1', sdp: 'oferta-de-laura' });
    expect(await laura.next('RESPUESTA')).toEqual({
      type: 'RESPUESTA',
      id: 'n-1',
      sdp: 'respuesta-1',
    });
    expect(peers.last().remoteDescription).toEqual({ type: 'offer', sdp: 'oferta-de-laura' });
    expect(
      callRegion().getByRole('figure', { name: 'Laura Martínez, cámara apagada' }),
    ).toBeInTheDocument();
  });

  it('vuelve a sus citas al salir', async () => {
    installCamera();
    installPeerConnection();
    await activateAsPsychologist();
    const { user, router } = openAs('EMPLEADO', employeeRoomPath(RESERVATION));
    await user.click(await screen.findByRole('button', { name: 'Entrar a la llamada' }));

    await user.click(await screen.findByRole('button', { name: 'Salir de la sala' }));

    expect(router.state.location.pathname).toBe(EMPLOYEE_PATHS.appointments);
  });

  it('las señales de otra sala o mal formadas no llegan a la llamada', async () => {
    installCamera();
    const peers = installPeerConnection();
    await activateAsPsychologist();
    const { user } = openAs('EMPLEADO', employeeRoomPath(RESERVATION));
    await user.click(await screen.findByRole('button', { name: 'Entrar a la llamada' }));
    await screen.findByRole('region', { name: 'Videollamada' });
    const david = 'usr-empleado-001';

    act(() => {
      publishToUser(david, ROOMS_QUEUE, {
        type: 'SENAL',
        reservationId: 'reserva-18',
        signal: { type: 'OFERTA', id: 'n-9', sdp: 'otra-sala' },
      });
      publishToUser(david, ROOMS_QUEUE, { type: 'SENAL', reservationId: RESERVATION, signal: {} });
      publishToUser(david, ROOMS_QUEUE, {
        type: 'SENAL',
        reservationId: RESERVATION,
        signal: { type: 'OFERTA', id: 'n-1', sdp: 'de-laura' },
      });
    });

    await waitFor(() => {
      expect(peers.last().remoteDescription).toEqual({ type: 'offer', sdp: 'de-laura' });
    });
    expect(peers.last().index).toBe(1);
  });
});
