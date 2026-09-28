import { onTestFinished, vi } from 'vitest';

/**
 * WebRTC y cámara falsos para jsdom (que no los implementa). Las pruebas deciden qué entrega
 * `getUserMedia` y qué hace cada `RTCPeerConnection`: candidatos, pistas y estado de conexión.
 */

export class FakeTrack {
  enabled = true;
  readyState: MediaStreamTrackState = 'live';
  readonly kind: 'audio' | 'video';
  readonly stop = vi.fn(() => {
    this.readyState = 'ended';
  });

  constructor(kind: 'audio' | 'video') {
    this.kind = kind;
  }
}

let streams = 0;

export class FakeStream {
  readonly id: string;
  readonly tracks: FakeTrack[];

  constructor() {
    streams += 1;
    this.id = `stream-${String(streams)}`;
    this.tracks = [new FakeTrack('audio'), new FakeTrack('video')];
  }

  getTracks() {
    return [...this.tracks];
  }

  track(kind: 'audio' | 'video'): FakeTrack {
    const track = this.tracks.find((candidate) => candidate.kind === kind);
    if (track === undefined) {
      throw new Error(`El stream no tiene pista de ${kind}`);
    }
    return track;
  }
}

/** Un stream falso donde el código espera uno real. */
export function asMediaStream(stream: FakeStream): MediaStream {
  return stream as unknown as MediaStream;
}

/** Cámara y micrófono del equipo: cada llamada a `getUserMedia` entrega un stream nuevo. */
export function installCamera(result: 'ok' | DOMException | 'pending' = 'ok') {
  const granted: FakeStream[] = [];
  let release: ((outcome: 'ok' | DOMException) => void) | null = null;
  const getUserMedia = vi.fn(() => {
    const stream = new FakeStream();
    if (result === 'ok') {
      granted.push(stream);
      return Promise.resolve(asMediaStream(stream));
    }
    if (result === 'pending') {
      return new Promise<MediaStream>((resolve, reject) => {
        release = (outcome) => {
          if (outcome === 'ok') {
            granted.push(stream);
            resolve(asMediaStream(stream));
          } else {
            reject(outcome);
          }
        };
      });
    }
    return Promise.reject(result);
  });
  // jsdom no trae `navigator.mediaDevices`: se agrega solo durante esta prueba.
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  });
  onTestFinished(() => {
    Reflect.deleteProperty(navigator, 'mediaDevices');
  });
  return {
    getUserMedia,
    granted,
    /** Resuelve (o rechaza) un `getUserMedia` pendiente. */
    release: (outcome: 'ok' | DOMException) => {
      release?.(outcome);
    },
  };
}

export class FakePeerConnection {
  static readonly instances: FakePeerConnection[] = [];

  readonly config: RTCConfiguration;
  connectionState: RTCPeerConnectionState = 'new';
  remoteDescription: RTCSessionDescriptionInit | null = null;
  localDescription: RTCSessionDescriptionInit | null = null;
  readonly tracks: MediaStreamTrack[] = [];
  readonly candidates: RTCIceCandidateInit[] = [];
  closed = false;
  onicecandidate: ((event: { candidate: RTCIceCandidateInit | null }) => void) | null = null;
  ontrack: ((event: { streams: MediaStream[] }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;

  constructor(config: RTCConfiguration) {
    this.config = config;
    FakePeerConnection.instances.push(this);
  }

  addTrack(track: MediaStreamTrack) {
    this.tracks.push(track);
  }

  createOffer() {
    return Promise.resolve({ type: 'offer' as const, sdp: `oferta-${String(this.index)}` });
  }

  createAnswer() {
    return Promise.resolve({ type: 'answer' as const, sdp: `respuesta-${String(this.index)}` });
  }

  setLocalDescription(description: RTCSessionDescriptionInit) {
    this.localDescription = description;
    return Promise.resolve();
  }

  setRemoteDescription(description: RTCSessionDescriptionInit) {
    this.remoteDescription = description;
    return Promise.resolve();
  }

  addIceCandidate(candidate: RTCIceCandidateInit) {
    this.candidates.push(candidate);
    return Promise.resolve();
  }

  close() {
    this.closed = true;
  }

  get index(): number {
    return FakePeerConnection.instances.indexOf(this) + 1;
  }

  emitCandidate(candidate: RTCIceCandidateInit | null) {
    this.onicecandidate?.({ candidate });
  }

  emitTrack(streamsOfTrack: MediaStream[]) {
    this.ontrack?.({ streams: streamsOfTrack });
  }

  setState(state: RTCPeerConnectionState) {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
}

/** Reemplaza `RTCPeerConnection` por la falsa; devuelve la última conexión creada. */
export function installPeerConnection() {
  FakePeerConnection.instances.length = 0;
  vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
  return {
    last(): FakePeerConnection {
      const peer = FakePeerConnection.instances.at(-1);
      if (peer === undefined) {
        throw new Error('Aún no se creó ninguna conexión WebRTC');
      }
      return peer;
    },
  };
}
