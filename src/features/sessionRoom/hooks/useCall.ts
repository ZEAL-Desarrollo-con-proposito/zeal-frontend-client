import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useRealtimePublish,
  useRealtimeStatus,
  useRealtimeSubscription,
} from '@/shared/realtime/useRealtime';
import { browserPeerFactory } from '../call/browserPeer';
import type { CallRole, CallSession, CallSnapshot } from '../call/callSession';
import { createCallSession, INITIAL_CALL } from '../call/callSession';
import type { MediaErrorReason } from '../call/localMedia';
import { mediaErrorReason, requestLocalMedia, stopMedia } from '../call/localMedia';
import type { IceServer } from '../model/room';
import type { MediaState } from '../model/roomEvent';
import { isRoomEvent, ROOMS_QUEUE, signalDestination } from '../model/roomEvent';

export type CallPhase =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'media-error'; reason: MediaErrorReason }
  | { kind: 'joined'; localStream: MediaStream };

interface CallOptions {
  reservationId: string;
  role: CallRole;
  iceServers: IceServer[];
}

const ALL_ON: MediaState = { audio: true, video: true };

/**
 * Videollamada de la sala: enciende la cámara y el micrófono al entrar, negocia el video con la
 * otra persona por el Real-Time Gateway y libera la cámara al salir (también al cerrar la
 * pantalla). Al recuperarse la conexión con ZEAL vuelve a saludar para renegociar.
 */
export function useCall({ reservationId, role, iceServers }: CallOptions) {
  const publish = useRealtimePublish();
  const { recoveries } = useRealtimeStatus();
  const [phase, setPhase] = useState<CallPhase>({ kind: 'idle' });
  const [call, setCall] = useState<CallSnapshot>(INITIAL_CALL);
  const [media, setMedia] = useState<MediaState>(ALL_ON);
  /** Último estado del micrófono y la cámara, aunque aún no se haya vuelto a pintar. */
  const mediaRef = useRef<MediaState>(ALL_ON);
  const session = useRef<CallSession | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  /** Cada intento de entrar; uno que termina después de salir se descarta. */
  const attempt = useRef(0);

  useRealtimeSubscription(ROOMS_QUEUE, (payload) => {
    if (
      isRoomEvent(payload) &&
      payload.type === 'SENAL' &&
      payload.reservationId === reservationId
    ) {
      session.current?.receive(payload.signal);
    }
  });

  const hangUp = useCallback(() => {
    attempt.current += 1;
    session.current?.leave();
    session.current = null;
    if (localStream.current !== null) {
      stopMedia(localStream.current);
      localStream.current = null;
    }
  }, []);

  useEffect(() => hangUp, [hangUp]);

  useEffect(() => {
    session.current?.start();
  }, [recoveries]);

  async function join() {
    attempt.current += 1;
    const own = attempt.current;
    setPhase({ kind: 'starting' });
    let stream: MediaStream;
    try {
      stream = await requestLocalMedia();
    } catch (error) {
      if (own === attempt.current) {
        setPhase({ kind: 'media-error', reason: mediaErrorReason(error) });
      }
      return;
    }
    if (own !== attempt.current) {
      stopMedia(stream);
      return;
    }
    localStream.current = stream;
    session.current = createCallSession({
      role,
      localStream: stream,
      createPeer: browserPeerFactory(iceServers),
      send: (signal) => {
        publish(signalDestination(reservationId), signal);
      },
      onChange: setCall,
    });
    mediaRef.current = ALL_ON;
    setMedia(ALL_ON);
    setCall(INITIAL_CALL);
    setPhase({ kind: 'joined', localStream: stream });
    session.current.start();
  }

  // Dos clics seguidos (micrófono y cámara) no se pisan: cada uno parte del último estado.
  function toggle(kind: keyof MediaState) {
    const next = { ...mediaRef.current, [kind]: !mediaRef.current[kind] };
    mediaRef.current = next;
    session.current?.setMedia(next);
    setMedia(next);
  }

  function leave() {
    hangUp();
    setPhase({ kind: 'idle' });
  }

  return {
    phase,
    call,
    media,
    join,
    leave,
    toggleAudio: () => {
      toggle('audio');
    },
    toggleVideo: () => {
      toggle('video');
    },
  };
}
