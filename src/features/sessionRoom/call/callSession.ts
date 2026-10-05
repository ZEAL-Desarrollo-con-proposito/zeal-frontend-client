import type { IceCandidate, MediaState, Signal } from '../model/roomEvent';

/** Quién negocia: el psicólogo llama (envía la oferta) y el empleado responde. */
export type CallRole = 'caller' | 'callee';

/** `waiting`: la otra persona aún no está en la sala; el resto describe la conexión del video. */
export type CallStatus = 'waiting' | 'connecting' | 'connected' | 'reconnecting';

export interface CallSnapshot {
  status: CallStatus;
  remoteStream: MediaStream | null;
  /** Micrófono y cámara de la otra persona, según su última señal. */
  remoteMedia: MediaState;
  /**
   * La otra persona estuvo en la sala y se fue (señal `SALIO`). Distingue "se fue" de "aún no
   * llega", que comparten el estado `waiting`. Vuelve a `false` cuando ella regresa.
   */
  remoteLeft: boolean;
}

export const INITIAL_CALL: CallSnapshot = {
  status: 'waiting',
  remoteStream: null,
  remoteMedia: { audio: true, video: true },
  remoteLeft: false,
};

export interface PeerEvents {
  onIceCandidate: (candidate: IceCandidate) => void;
  onTrack: (stream: MediaStream) => void;
  onStateChange: (state: RTCPeerConnectionState) => void;
}

/** Lo que la llamada necesita de una conexión WebRTC (en el navegador, `RTCPeerConnection`). */
export interface PeerConnection {
  addTrack: (track: MediaStreamTrack, stream: MediaStream) => void;
  createOffer: () => Promise<RTCSessionDescriptionInit>;
  createAnswer: () => Promise<RTCSessionDescriptionInit>;
  setLocalDescription: (description: RTCSessionDescriptionInit) => Promise<void>;
  setRemoteDescription: (description: RTCSessionDescriptionInit) => Promise<void>;
  addIceCandidate: (candidate: IceCandidate) => Promise<void>;
  close: () => void;
}

export type PeerFactory = (events: PeerEvents) => PeerConnection;

interface CallSessionOptions {
  role: CallRole;
  localStream: MediaStream;
  createPeer: PeerFactory;
  /** Envía una señal a la otra persona por el Real-Time Gateway. */
  send: (signal: Signal) => void;
  onChange: (snapshot: CallSnapshot) => void;
}

export interface CallSession {
  /** Saluda (al entrar o al recuperar la conexión): quien llama responde con una oferta nueva. */
  start: () => void;
  receive: (signal: Signal) => void;
  /** Apaga o enciende el micrófono y la cámara propios, y avisa a la otra persona. */
  setMedia: (media: MediaState) => void;
  /** Avisa a la otra persona y cierra la conexión. */
  leave: () => void;
}

interface Peer {
  /** Negociación a la que pertenece: la oferta que la abrió. */
  id: string;
  connection: PeerConnection;
  /** Candidatos que llegaron antes que la descripción remota; se aplican después. */
  pending: IceCandidate[];
  hasRemoteDescription: boolean;
}

/**
 * Videollamada 1:1 sobre WebRTC con señalización por el Real-Time Gateway:
 * - solo quien llama envía ofertas, así nunca se cruzan dos negociaciones;
 * - cada negociación abre una conexión nueva y descarta lo que llegue de una anterior;
 * - si la conexión falla, quien llama renegocia y quien responde pide una oferta nueva.
 */
export function createCallSession({
  role,
  localStream,
  createPeer,
  send,
  onChange,
}: CallSessionOptions): CallSession {
  let snapshot = INITIAL_CALL;
  let media: MediaState = { audio: true, video: true };
  let current: Peer | null = null;
  let left = false;

  function update(changes: Partial<CallSnapshot>) {
    snapshot = { ...snapshot, ...changes };
    onChange(snapshot);
  }

  function closePeer() {
    current?.connection.close();
    current = null;
  }

  function fail(peer: Peer) {
    if (current === peer) {
      update({ status: 'reconnecting' });
    }
  }

  function handleState(state: RTCPeerConnectionState) {
    if (state === 'connected') {
      update({ status: 'connected' });
    } else if (state === 'disconnected') {
      update({ status: 'reconnecting' });
    } else if (state === 'failed') {
      update({ status: 'reconnecting' });
      if (role === 'caller') {
        void offer();
      } else {
        send({ type: 'LISTO', media });
      }
    }
  }

  function openPeer(id: string): Peer {
    closePeer();
    const peer: Peer = {
      id,
      connection: createPeer({
        onIceCandidate: (candidate) => {
          if (current === peer) {
            send({ type: 'CANDIDATO', id, candidate });
          }
        },
        onTrack: (stream) => {
          if (current === peer) {
            update({ remoteStream: stream });
          }
        },
        onStateChange: (state) => {
          if (current === peer) {
            handleState(state);
          }
        },
      }),
      pending: [],
      hasRemoteDescription: false,
    };
    for (const track of localStream.getTracks()) {
      peer.connection.addTrack(track, localStream);
    }
    current = peer;
    update({ status: 'connecting', remoteLeft: false });
    return peer;
  }

  async function acceptRemote(peer: Peer, description: RTCSessionDescriptionInit) {
    await peer.connection.setRemoteDescription(description);
    peer.hasRemoteDescription = true;
    await Promise.all(
      peer.pending.splice(0).map((candidate) => peer.connection.addIceCandidate(candidate)),
    );
  }

  async function offer() {
    const peer = openPeer(crypto.randomUUID());
    try {
      const description = await peer.connection.createOffer();
      await peer.connection.setLocalDescription(description);
      if (current === peer) {
        send({ type: 'OFERTA', id: peer.id, sdp: description.sdp ?? '' });
      }
    } catch {
      fail(peer);
    }
  }

  async function answer(id: string, sdp: string) {
    const peer = openPeer(id);
    try {
      await acceptRemote(peer, { type: 'offer', sdp });
      const description = await peer.connection.createAnswer();
      await peer.connection.setLocalDescription(description);
      if (current === peer) {
        send({ type: 'RESPUESTA', id, sdp: description.sdp ?? '' });
      }
    } catch {
      fail(peer);
    }
  }

  async function accept(id: string, sdp: string) {
    const peer = current;
    // Una respuesta a otra oferta (atrasada) o repetida se descarta.
    if (peer?.id !== id || peer.hasRemoteDescription) {
      return;
    }
    try {
      await acceptRemote(peer, { type: 'answer', sdp });
    } catch {
      fail(peer);
    }
  }

  async function addCandidate(id: string, candidate: IceCandidate) {
    const peer = current;
    if (peer?.id !== id) {
      return;
    }
    if (!peer.hasRemoteDescription) {
      peer.pending.push(candidate);
      return;
    }
    try {
      await peer.connection.addIceCandidate(candidate);
    } catch {
      // Un candidato inválido no corta la llamada: los demás siguen probándose.
    }
  }

  function receive(signal: Signal) {
    if (left) {
      return;
    }
    switch (signal.type) {
      case 'LISTO':
        // Si volvió a la sala, el aviso de que se fue deja de aplicar.
        update({ remoteMedia: signal.media, remoteLeft: false });
        if (role === 'caller') {
          void offer();
        } else {
          // Quien responde confirma que está: así quien llama sabe que puede ofrecer.
          send({ type: 'LISTO', media });
        }
        break;
      case 'OFERTA':
        if (role === 'callee') {
          void answer(signal.id, signal.sdp);
        }
        break;
      case 'RESPUESTA':
        if (role === 'caller') {
          void accept(signal.id, signal.sdp);
        }
        break;
      case 'CANDIDATO':
        void addCandidate(signal.id, signal.candidate);
        break;
      case 'MEDIOS':
        update({ remoteMedia: signal.media });
        break;
      case 'SALIO':
        closePeer();
        update({ status: 'waiting', remoteStream: null, remoteLeft: true });
        break;
    }
  }

  return {
    start() {
      if (!left) {
        send({ type: 'LISTO', media });
      }
    },
    receive,
    setMedia(next) {
      media = next;
      // Una pista deshabilitada deja de enviar sin renegociar la llamada.
      for (const track of localStream.getTracks()) {
        track.enabled = track.kind === 'audio' ? media.audio : media.video;
      }
      if (!left) {
        send({ type: 'MEDIOS', media });
      }
    },
    leave() {
      if (left) {
        return;
      }
      left = true;
      send({ type: 'SALIO' });
      closePeer();
    },
  };
}
