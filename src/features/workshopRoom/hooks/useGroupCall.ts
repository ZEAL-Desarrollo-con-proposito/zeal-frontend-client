import { useEffect, useRef, useState } from 'react';
import type { MediaErrorReason } from '@/features/sessionRoom/call/localMedia';
import { mediaErrorReason } from '@/features/sessionRoom/call/localMedia';
import type { MediaState } from '@/features/sessionRoom/model/roomEvent';
import { API_BASE_URL } from '@/shared/config/apiBaseUrl';
import type {
  GroupCall,
  GroupCallConnector,
  GroupCallSnapshot,
  GroupChatMessage,
} from '../call/groupCall';
import type { WorkshopRoomConnection } from '../model/workshopRoom';
import { resolveServerUrl } from '../model/workshopRoom';

export type GroupCallPhase =
  | { kind: 'idle' }
  | { kind: 'joining' }
  | { kind: 'joined'; snapshot: GroupCallSnapshot }
  | { kind: 'failed' }
  | { kind: 'ended' };

/** El SDK de video pesa varios cientos de kB: se descarga solo cuando alguien entra a una sala. */
const connectWithLiveKit: GroupCallConnector = async (options) => {
  const { connectLiveKit } = await import('../call/liveKitGroupCall');
  return connectLiveKit(options);
};

/** Al entrar se encienden micrófono y cámara; cada quien los apaga cuando quiera. */
const INITIAL_MEDIA: MediaState = { audio: true, video: true };

/**
 * Videollamada grupal del taller: entrar, encender o apagar micrófono y cámara, y salir. Si el
 * navegador niega la cámara, la persona igual queda en la sala (puede escuchar y ver) y se le
 * explica cómo dar el permiso.
 */
export function useGroupCall(connector: GroupCallConnector = connectWithLiveKit) {
  const [phase, setPhase] = useState<GroupCallPhase>({ kind: 'idle' });
  const [media, setMediaState] = useState<MediaState>(INITIAL_MEDIA);
  const [mediaError, setMediaError] = useState<MediaErrorReason | null>(null);
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [chatFailed, setChatFailed] = useState(false);
  const callRef = useRef<GroupCall | null>(null);

  useEffect(
    () => () => {
      callRef.current?.leave();
      callRef.current = null;
    },
    [],
  );

  async function applyMedia(call: GroupCall, next: MediaState) {
    setMediaState(next);
    try {
      await call.setMedia(next);
      setMediaError(null);
    } catch (error) {
      setMediaError(mediaErrorReason(error));
      setMediaState({ audio: false, video: false });
    }
  }

  async function join(connection: WorkshopRoomConnection) {
    setPhase({ kind: 'joining' });
    // El chat del taller vive en la sala: al volver a entrar empieza vacío.
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
