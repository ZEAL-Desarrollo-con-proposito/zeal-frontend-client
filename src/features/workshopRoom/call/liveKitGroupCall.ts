import type { Participant } from 'livekit-client';
import { ConnectionState, Room, RoomEvent, Track } from 'livekit-client';
import { isRecord } from '@/features/auth/model/session';
import type { GroupCallConnector, GroupCallSnapshot, GroupParticipant } from './groupCall';

/** Cualquier cambio de personas, pistas o voz activa vuelve a dibujar la llamada. */
const REFRESH_EVENTS = [
  RoomEvent.ParticipantConnected,
  RoomEvent.ParticipantDisconnected,
  RoomEvent.ParticipantMetadataChanged,
  RoomEvent.TrackSubscribed,
  RoomEvent.TrackUnsubscribed,
  RoomEvent.TrackMuted,
  RoomEvent.TrackUnmuted,
  RoomEvent.LocalTrackPublished,
  RoomEvent.LocalTrackUnpublished,
  RoomEvent.ActiveSpeakersChanged,
  RoomEvent.Reconnecting,
  RoomEvent.Reconnected,
] as const;

/** El servidor firma el rol de cada persona en su metadata: `{"role":"ANFITRION"}`. */
export function isHostMetadata(metadata: string | undefined): boolean {
  try {
    const parsed: unknown = JSON.parse(metadata ?? '');
    return isRecord(parsed) && parsed.role === 'ANFITRION';
  } catch {
    return false;
  }
}

/**
 * Adaptador de LiveKit: une la sala del SDK con el modelo de la llamada. Cada persona se dibuja
 * con un `MediaStream` (cámara y, si es otra persona, micrófono) que solo se recrea cuando
 * cambian sus pistas: reasignarlo reiniciaría la reproducción.
 */
export const connectLiveKit: GroupCallConnector = async ({ serverUrl, token, onChange }) => {
  // Sin adaptiveStream: el video se dibuja con el MediaStream del navegador, no con attach().
  const room = new Room({ adaptiveStream: false, dynacast: true });
  const streams = new Map<string, { key: string; stream: MediaStream }>();
  let ended = false;

  function streamOf(participant: Participant, self: boolean): MediaStream | null {
    const sources = self ? [Track.Source.Camera] : [Track.Source.Camera, Track.Source.Microphone];
    const tracks = sources.flatMap((source) => {
      const track = participant.getTrackPublication(source)?.track?.mediaStreamTrack;
      return track === undefined ? [] : [track];
    });
    if (tracks.length === 0) {
      streams.delete(participant.identity);
      return null;
    }
    const key = tracks.map((track) => track.id).join('|');
    const cached = streams.get(participant.identity);
    if (cached?.key === key) {
      return cached.stream;
    }
    const stream = new MediaStream(tracks);
    streams.set(participant.identity, { key, stream });
    return stream;
  }

  function toParticipant(participant: Participant, self: boolean): GroupParticipant {
    return {
      id: participant.identity,
      name:
        participant.name === undefined || participant.name === ''
          ? participant.identity
          : participant.name,
      host: isHostMetadata(participant.metadata),
      self,
      stream: streamOf(participant, self),
      media: { audio: participant.isMicrophoneEnabled, video: participant.isCameraEnabled },
      speaking: participant.isSpeaking,
    };
  }

  function snapshot(): GroupCallSnapshot {
    let status: GroupCallSnapshot['status'] = 'connected';
    if (ended) {
      status = 'ended';
    } else if (room.state === ConnectionState.Reconnecting) {
      status = 'reconnecting';
    }
    return {
      status,
      participants: [
        toParticipant(room.localParticipant, true),
        ...[...room.remoteParticipants.values()].map((participant) =>
          toParticipant(participant, false),
        ),
      ],
    };
  }

  function notify() {
    onChange(snapshot());
  }

  for (const event of REFRESH_EVENTS) {
    room.on(event, notify);
  }
  room.on(RoomEvent.Disconnected, () => {
    ended = true;
    notify();
  });

  await room.connect(serverUrl, token);
  notify();

  return {
    async setMedia(media) {
      try {
        await room.localParticipant.setMicrophoneEnabled(media.audio);
        await room.localParticipant.setCameraEnabled(media.video);
      } finally {
        notify();
      }
    },
    leave() {
      ended = true;
      void room.disconnect();
    },
  };
};
