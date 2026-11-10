import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '@/shared/config/apiBaseUrl';
import type { MediaErrorReason } from '../call/mediaError';
import { mediaErrorReason } from '../call/mediaError';
import type {
  CallChatMessage,
  MediaState,
  VideoCall,
  VideoCallConnector,
  VideoCallSnapshot,
  VideoConnection,
} from '../call/videoCall';
import { resolveServerUrl } from '../call/videoCall';

export type VideoCallPhase =
  | { kind: 'idle' }
  | { kind: 'joining' }
  | { kind: 'joined'; snapshot: VideoCallSnapshot }
  | { kind: 'failed' }
  | { kind: 'ended' };

/** El SDK de video pesa varios cientos de kB: se descarga solo cuando alguien entra a una sala. */
const connectWithLiveKit: VideoCallConnector = async (options) => {
  const { connectLiveKit } = await import('../call/liveKitVideoCall');
  return connectLiveKit(options);
};

/** Al entrar se encienden micrófono y cámara; cada quien los apaga cuando quiera. */
const INITIAL_MEDIA: MediaState = { audio: true, video: true };

/**
 * Videollamada de una sala (sesión 1:1 o taller en vivo, ADR-14): entrar, encender o apagar
 * micrófono y cámara, y salir. Si el navegador niega la cámara, la persona igual queda en la sala
 * (puede escuchar y ver) y se le explica cómo dar el permiso.
 */
export function useVideoCall(connector: VideoCallConnector = connectWithLiveKit) {
  const [phase, setPhase] = useState<VideoCallPhase>({ kind: 'idle' });
  const [media, setMediaState] = useState<MediaState>(INITIAL_MEDIA);
  const [mediaError, setMediaError] = useState<MediaErrorReason | null>(null);
  const [messages, setMessages] = useState<CallChatMessage[]>([]);
  const [chatFailed, setChatFailed] = useState(false);
  const callRef = useRef<VideoCall | null>(null);

  useEffect(
    () => () => {
      callRef.current?.leave();
      callRef.current = null;
    },
    [],
  );

  async function applyMedia(call: VideoCall, next: MediaState) {
    setMediaState(next);
    try {
      await call.setMedia(next);
      setMediaError(null);
    } catch (error) {
      setMediaError(mediaErrorReason(error));
      setMediaState({ audio: false, video: false });
    }
  }

  async function join(connection: VideoConnection) {
    setPhase({ kind: 'joining' });
    // El chat de la sala vive en la sala: al volver a entrar empieza vacío.
    setMessages([]);
    try {
      const call = await connector({
        serverUrl: resolveServerUrl(connection.serverUrl, API_BASE_URL),
        token: connection.token,
        onChange: (snapshot) => {
          setPhase(snapshot.status === 'ended' ? { kind: 'ended' } : { kind: 'joined', snapshot });
        },
        onMessage: (message) => {
          setMessages((current) =>
            current.some(({ id }) => id === message.id) ? current : [...current, message],
          );
        },
      });
      callRef.current = call;
      await applyMedia(call, media);
    } catch {
      setPhase({ kind: 'failed' });
    }
  }

  function toggle(field: keyof MediaState) {
    const call = callRef.current;
    if (call !== null) {
      void applyMedia(call, { ...media, [field]: !media[field] });
    }
  }

  function sendMessage(text: string) {
    const call = callRef.current;
    if (call === null) {
      return;
    }
    setChatFailed(false);
    call.sendMessage(text).catch(() => {
      setChatFailed(true);
    });
  }

  function leave() {
    callRef.current?.leave();
    callRef.current = null;
    setPhase({ kind: 'ended' });
  }

  return {
    phase,
    media,
    mediaError,
    messages,
    chatFailed,
    sendMessage,
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
