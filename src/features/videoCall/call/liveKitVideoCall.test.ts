import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CallChatMessage, VideoCallSnapshot } from './videoCall';
import { CHAT_TOPIC, connectLiveKit, isHostMetadata, parseChatPayload } from './liveKitVideoCall';

/** Sala de LiveKit simulada: la prueba decide quién está, qué publica y qué eventos llegan. */
const sdk = vi.hoisted(() => {
  type Handler = (...args: unknown[]) => void;

  class FakeParticipant {
    identity: string;
    name: string | undefined;
    metadata: string | undefined;
    isMicrophoneEnabled = true;
    isCameraEnabled = true;
    isSpeaking = false;
    tracks = new Map<string, { id: string }>();

    constructor(identity: string, name?: string, metadata?: string) {
      this.identity = identity;
      this.name = name;
      this.metadata = metadata;
    }

    getTrackPublication(source: string) {
      const track = this.tracks.get(source);
      return track === undefined ? undefined : { track: { mediaStreamTrack: track } };
    }
  }

  class FakeLocalParticipant extends FakeParticipant {
    setMicrophoneEnabled = vi.fn((enabled: boolean) => {
      this.isMicrophoneEnabled = enabled;
      return Promise.resolve();
    });
    setCameraEnabled = vi.fn((enabled: boolean) => {
      this.isCameraEnabled = enabled;
      return Promise.resolve();
    });
    publishData = vi.fn<(data: Uint8Array, options: unknown) => Promise<void>>(() =>
      Promise.resolve(),
    );
  }

  const rooms: FakeRoom[] = [];

  class FakeRoom {
    readonly options: unknown;
    state = 'connected';
    localParticipant = new FakeLocalParticipant(
      'usr-admin-001',
      'Talento Humano',
      '{"role":"ANFITRION"}',
    );
    remoteParticipants = new Map<string, FakeParticipant>();
    handlers = new Map<string, Handler[]>();
    connect = vi.fn(() => Promise.resolve());
    disconnect = vi.fn(() => {
      this.emit('disconnected');
      return Promise.resolve();
    });

    constructor(options: unknown) {
      this.options = options;
      rooms.push(this);
    }

    on(event: string, handler: Handler) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
      return this;
    }

    emit(event: string, ...args: unknown[]) {
      for (const handler of this.handlers.get(event) ?? []) {
        handler(...args);
      }
    }
  }

  return { FakeRoom, FakeParticipant, rooms };
});

vi.mock('livekit-client', () => ({
  Room: sdk.FakeRoom,
  ConnectionState: { Reconnecting: 'reconnecting' },
  Track: { Source: { Camera: 'camera', Microphone: 'microphone' } },
  RoomEvent: {
    ParticipantConnected: 'participantConnected',
    ParticipantDisconnected: 'participantDisconnected',
    ParticipantMetadataChanged: 'participantMetadataChanged',
    TrackSubscribed: 'trackSubscribed',
    TrackUnsubscribed: 'trackUnsubscribed',
    TrackMuted: 'trackMuted',
    TrackUnmuted: 'trackUnmuted',
    LocalTrackPublished: 'localTrackPublished',
    LocalTrackUnpublished: 'localTrackUnpublished',
    ActiveSpeakersChanged: 'activeSpeakersChanged',
    Reconnecting: 'reconnecting',
    Reconnected: 'reconnected',
    Disconnected: 'disconnected',
    DataReceived: 'dataReceived',
  },
}));

class StubMediaStream {
  readonly tracks: unknown[];
  constructor(tracks: unknown[]) {
    this.tracks = tracks;
  }
}

beforeEach(() => {
  vi.stubGlobal('MediaStream', StubMediaStream);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function room() {
  const current = sdk.rooms.at(-1);
  if (current === undefined) {
    throw new Error('No se creó la sala');
  }
  return current;
}

async function connect() {
  const snapshots: VideoCallSnapshot[] = [];
  const messages: CallChatMessage[] = [];
  const call = await connectLiveKit({
    serverUrl: 'wss://zeal.co/livekit',
    token: 'permiso',
    onChange: (snapshot) => snapshots.push(snapshot),
    onMessage: (message) => messages.push(message),
  });
  const latest = () => {
    const snapshot = snapshots.at(-1);
    if (snapshot === undefined) {
      throw new Error('Sin cambios');
    }
    return snapshot;
  };
  return { call, snapshots, latest, messages };
}

describe('connectLiveKit', () => {
  it('se conecta con la URL y el permiso, y muestra primero a la persona misma', async () => {
    const { latest } = await connect();

    expect(room().connect).toHaveBeenCalledWith('wss://zeal.co/livekit', 'permiso');
    expect(room().options).toEqual({
      adaptiveStream: false,
      dynacast: true,
      disconnectOnPageLeave: true,
    });
    expect(latest()).toEqual({
      status: 'connected',
      participants: [
        {
          id: 'usr-admin-001',
          name: 'Talento Humano',
          host: true,
          self: true,
          stream: null,
          media: { audio: true, video: true },
          speaking: false,
        },
      ],
    });
  });

  it('dibuja a cada persona con su video y su audio, y conserva el stream mientras no cambien sus pistas', async () => {
    const { latest } = await connect();
    const david = new sdk.FakeParticipant(
      'usr-empleado-001',
      'David Cajamarca',
      '{"role":"PARTICIPANTE"}',
    );
    david.tracks.set('camera', { id: 'video-david' });
    david.tracks.set('microphone', { id: 'audio-david' });
    const anon = new sdk.FakeParticipant('usr-sin-nombre', '');
    const unnamedGuest = new sdk.FakeParticipant('usr-invitado');
    room().remoteParticipants.set(david.identity, david);
    room().remoteParticipants.set(anon.identity, anon);
    room().remoteParticipants.set(unnamedGuest.identity, unnamedGuest);
    room().localParticipant.tracks.set('camera', { id: 'video-propio' });
    room().localParticipant.tracks.set('microphone', { id: 'audio-propio' });
    room().emit('participantConnected');

    const [self, remote, unnamed, guest] = latest().participants;
    // El audio propio no se reproduce (eco): el stream propio solo lleva la cámara.
    expect((self?.stream as unknown as StubMediaStream).tracks).toEqual([{ id: 'video-propio' }]);
    expect((remote?.stream as unknown as StubMediaStream).tracks).toEqual([
      { id: 'video-david' },
      { id: 'audio-david' },
    ]);
    expect(remote).toMatchObject({ name: 'David Cajamarca', host: false, self: false });
    expect(unnamed).toMatchObject({ name: 'usr-sin-nombre', stream: null });
    expect(guest).toMatchObject({ name: 'usr-invitado', host: false });

    const firstStream = remote?.stream;
    david.isSpeaking = true;
    room().emit('activeSpeakersChanged');
    expect(latest().participants[1]?.stream).toBe(firstStream);
    expect(latest().participants[1]?.speaking).toBe(true);

    david.tracks.delete('camera');
    room().emit('trackUnsubscribed');
    expect(latest().participants[1]?.stream).not.toBe(firstStream);

    david.tracks.clear();
    room().emit('trackUnsubscribed');
    expect(latest().participants[1]?.stream).toBeNull();
  });

  it('avisa cuando se pierde la conexión y cuando el servidor la cierra', async () => {
    const { latest } = await connect();

    room().state = 'reconnecting';
    room().emit('reconnecting');
    expect(latest().status).toBe('reconnecting');

    room().state = 'connected';
    room().emit('reconnected');
    expect(latest().status).toBe('connected');

    room().emit('disconnected');
    expect(latest().status).toBe('ended');
  });

  it('enciende o apaga micrófono y cámara, y redibuja aunque el navegador niegue el permiso', async () => {
    const { call, latest } = await connect();

    await call.setMedia({ audio: false, video: true });
    expect(room().localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(false);
    expect(room().localParticipant.setCameraEnabled).toHaveBeenCalledWith(true);
    expect(latest().participants[0]?.media).toEqual({ audio: false, video: true });

    const denied = new DOMException('Permiso denegado', 'NotAllowedError');
    room().localParticipant.setCameraEnabled.mockRejectedValueOnce(denied);
    await expect(call.setMedia({ audio: true, video: true })).rejects.toBe(denied);
    expect(latest().participants[0]?.media.audio).toBe(true);
  });

  it('al salir se desconecta del servidor', async () => {
    const { call, latest } = await connect();

    call.leave();

    expect(room().disconnect).toHaveBeenCalled();
    expect(latest().status).toBe('ended');
  });
});

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const CHAT = {
  id: 'm-1',
  text: '¿Pueden repetir el ejercicio?',
  sentAt: '2026-09-23T14:30:00.000Z',
};

describe('chat de la sala', () => {
  it('envía el mensaje a la sala por el canal del chat y lo muestra como propio', async () => {
    const { call, messages } = await connect();

    await call.sendMessage('  Hola a todos  ');

    const published = room().localParticipant.publishData.mock.calls[0];
    if (published === undefined) {
      throw new Error('No se publicó el mensaje');
    }
    const [data, options] = published;
    expect(options).toEqual({ reliable: true, topic: CHAT_TOPIC });
    const sent = parseChatPayload(data);
    expect(sent?.text).toBe('Hola a todos');
    expect(messages).toEqual([
      {
        id: sent?.id,
        text: 'Hola a todos',
        sentAt: sent?.sentAt,
        senderId: 'usr-admin-001',
        senderName: 'Talento Humano',
        self: true,
      },
    ]);
  });

  it('si no se puede enviar, no lo muestra como enviado', async () => {
    const { call, messages } = await connect();
    room().localParticipant.publishData.mockRejectedValueOnce(new Error('sin conexión'));

    await expect(call.sendMessage('Hola')).rejects.toThrow('sin conexión');
    expect(messages).toEqual([]);
  });

  it('muestra los mensajes de las demás personas y descarta lo que no es del chat', async () => {
    const { messages } = await connect();
    const david = new sdk.FakeParticipant('usr-empleado-001', 'David Cajamarca');

    room().emit('dataReceived', encode(CHAT), david, 0, CHAT_TOPIC);
    room().emit('dataReceived', encode(CHAT), david, 0, 'otro-canal');
    room().emit('dataReceived', encode(CHAT), undefined, 0, CHAT_TOPIC);
    room().emit('dataReceived', encode({ ...CHAT, text: '' }), david, 0, CHAT_TOPIC);

    expect(messages).toEqual([
      { ...CHAT, senderId: 'usr-empleado-001', senderName: 'David Cajamarca', self: false },
    ]);
  });
});

describe('parseChatPayload', () => {
  it.each([
    ['no es JSON', new TextEncoder().encode('hola')],
    ['no es un objeto', encode('hola')],
    ['sin id', encode({ ...CHAT, id: 3 })],
    ['sin texto', encode({ ...CHAT, text: undefined })],
    ['en blanco', encode({ ...CHAT, text: '   ' })],
    ['demasiado largo', encode({ ...CHAT, text: 'a'.repeat(2001) })],
    ['sin fecha', encode({ ...CHAT, sentAt: 7 })],
    ['con fecha inválida', encode({ ...CHAT, sentAt: 'ayer' })],
  ])('descarta un mensaje %s', (_, data) => {
    expect(parseChatPayload(data)).toBeNull();
  });
});

describe('isHostMetadata', () => {
  it('reconoce a la anfitriona solo con la metadata que firma el servidor', () => {
    expect(isHostMetadata('{"role":"ANFITRION"}')).toBe(true);
    expect(isHostMetadata('{"role":"PARTICIPANTE"}')).toBe(false);
    expect(isHostMetadata('["ANFITRION"]')).toBe(false);
    expect(isHostMetadata('no es JSON')).toBe(false);
    expect(isHostMetadata(undefined)).toBe(false);
  });
});
