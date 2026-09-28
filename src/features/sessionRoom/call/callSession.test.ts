import { describe, expect, it } from 'vitest';
import { asMediaStream, FakeStream } from '@/test/webrtc';
import type { IceCandidate, Signal } from '../model/roomEvent';
import type { CallRole, CallSnapshot, PeerConnection, PeerEvents } from './callSession';
import { createCallSession } from './callSession';

type Step = 'createOffer' | 'createAnswer' | 'setRemoteDescription' | 'addIceCandidate';

/** Conexión WebRTC de prueba: registra lo que recibe y permite fallar o demorar un paso. */
class TestPeer implements PeerConnection {
  readonly events: PeerEvents;
  readonly tracks: MediaStreamTrack[] = [];
  readonly remote: RTCSessionDescriptionInit[] = [];
  readonly candidates: IceCandidate[] = [];
  closed = false;
  /** Pasos que fallan, o que quedan pendientes hasta que la prueba los resuelva. */
  readonly failing = new Set<Step>();
  readonly held = new Map<Step, { resolve: () => void; reject: () => void }>();
  hold: Step | null = null;
  withoutSdp = false;

  constructor(events: PeerEvents) {
    this.events = events;
  }

  private step<T>(name: Step, value: T): Promise<T> {
    if (this.failing.has(name)) {
      return Promise.reject(new Error(`${name} falló`));
    }
    if (this.hold === name) {
      return new Promise<T>((resolve, reject) => {
        this.held.set(name, {
          resolve: () => {
            resolve(value);
          },
          reject: () => {
            reject(new Error(name));
          },
        });
      });
    }
    return Promise.resolve(value);
  }

  addTrack(track: MediaStreamTrack) {
    this.tracks.push(track);
  }

  createOffer() {
    return this.step('createOffer', {
      type: 'offer' as const,
      sdp: this.withoutSdp ? undefined : 'sdp-oferta',
    });
  }

  createAnswer() {
    return this.step('createAnswer', {
      type: 'answer' as const,
      sdp: this.withoutSdp ? undefined : 'sdp-respuesta',
    });
  }

  setLocalDescription() {
    return Promise.resolve();
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit) {
    await this.step('setRemoteDescription', undefined);
    this.remote.push(description);
  }

  async addIceCandidate(candidate: IceCandidate) {
    await this.step('addIceCandidate', undefined);
    this.candidates.push(candidate);
  }

  close() {
    this.closed = true;
  }
}

const CANDIDATE: IceCandidate = {
  candidate: 'candidate:1 1 udp 1 10.0.0.1 5000 typ host',
  sdpMid: '0',
  sdpMLineIndex: 0,
};
const ALL_ON = { audio: true, video: true };

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function setup(
  role: CallRole,
  configure: (peer: TestPeer, index: number) => void = () => undefined,
) {
  const peers: TestPeer[] = [];
  const sent: Signal[] = [];
  const snapshots: CallSnapshot[] = [];
  const stream = new FakeStream();
  const session = createCallSession({
    role,
    localStream: asMediaStream(stream),
    createPeer: (events) => {
      const peer = new TestPeer(events);
      configure(peer, peers.length);
      peers.push(peer);
      return peer;
    },
    send: (signal) => sent.push(signal),
    onChange: (snapshot) => snapshots.push(snapshot),
  });
  function peer(index: number): TestPeer {
    const found = peers[index];
    if (found === undefined) {
      throw new Error(`No hay conexión ${String(index)}`);
    }
    return found;
  }
  return {
    session,
    peers,
    peer,
    sent,
    stream,
    state: () => snapshots.at(-1),
    sentOf: <T extends Signal['type']>(type: T) =>
      sent.filter((signal): signal is Extract<Signal, { type: T }> => signal.type === type),
  };
}

function offerId(call: ReturnType<typeof setup>, index = 0): string {
  const offer = call.sentOf('OFERTA')[index];
  if (offer === undefined) {
    throw new Error('Aún no se envió la oferta');
  }
  return offer.id;
}

describe('createCallSession · quien llama (psicólogo)', () => {
  it('saluda al entrar con el estado de su micrófono y su cámara', () => {
    const call = setup('caller');

    call.session.setMedia({ audio: false, video: true });
    call.session.start();

    expect(call.stream.track('audio').enabled).toBe(false);
    expect(call.stream.track('video').enabled).toBe(true);
    expect(call.sent).toEqual([
      { type: 'MEDIOS', media: { audio: false, video: true } },
      { type: 'LISTO', media: { audio: false, video: true } },
    ]);
  });

  it('cuando la otra persona está lista, conecta sus pistas y le envía una oferta', async () => {
    const call = setup('caller');

    call.session.receive({ type: 'LISTO', media: { audio: true, video: false } });
    await flush();

    expect(call.peer(0).tracks).toHaveLength(2);
    expect(call.state()).toMatchObject({ status: 'connecting', remoteMedia: { video: false } });
    expect(call.sentOf('OFERTA')).toEqual([
      { type: 'OFERTA', id: expect.any(String) as string, sdp: 'sdp-oferta' },
    ]);
  });

  it('aplica la respuesta a su oferta y los candidatos, también los que llegaron antes', async () => {
    const call = setup('caller');
    call.session.receive({ type: 'LISTO', media: ALL_ON });
    await flush();
    const id = offerId(call);

    call.session.receive({ type: 'CANDIDATO', id, candidate: CANDIDATE });
    await flush();
    expect(call.peer(0).candidates).toEqual([]);

    call.session.receive({ type: 'RESPUESTA', id, sdp: 'sdp-respuesta' });
    await flush();
    expect(call.peer(0).remote).toEqual([{ type: 'answer', sdp: 'sdp-respuesta' }]);
    expect(call.peer(0).candidates).toEqual([CANDIDATE]);

    call.session.receive({ type: 'CANDIDATO', id, candidate: CANDIDATE });
    await flush();
    expect(call.peer(0).candidates).toHaveLength(2);
  });

  it('descarta respuestas y candidatos de otra negociación, y respuestas repetidas', async () => {
    const call = setup('caller');
    call.session.receive({ type: 'CANDIDATO', id: 'sin-conexion', candidate: CANDIDATE });
    call.session.receive({ type: 'RESPUESTA', id: 'sin-conexion', sdp: 'x' });
    call.session.receive({ type: 'LISTO', media: ALL_ON });
    await flush();
    const id = offerId(call);

    call.session.receive({ type: 'RESPUESTA', id: 'otra', sdp: 'vieja' });
    call.session.receive({ type: 'CANDIDATO', id: 'otra', candidate: CANDIDATE });
    call.session.receive({ type: 'RESPUESTA', id, sdp: 'buena' });
    await flush();
    call.session.receive({ type: 'RESPUESTA', id, sdp: 'repetida' });
    await flush();

    expect(call.peer(0).remote).toEqual([{ type: 'answer', sdp: 'buena' }]);
    expect(call.peer(0).candidates).toEqual([]);
  });

  it('envía sus candidatos, muestra el video remoto e ignora lo de conexiones anteriores', async () => {
    const call = setup('caller');
    call.session.receive({ type: 'LISTO', media: ALL_ON });
    await flush();
    const first = call.peer(0);
    const remote = asMediaStream(new FakeStream());

    first.events.onIceCandidate(CANDIDATE);
    first.events.onTrack(remote);
    expect(call.sentOf('CANDIDATO')).toEqual([
      { type: 'CANDIDATO', id: offerId(call), candidate: CANDIDATE },
    ]);
    expect(call.state()?.remoteStream).toBe(remote);

    call.session.receive({ type: 'LISTO', media: ALL_ON });
    await flush();
    expect(first.closed).toBe(true);
    first.events.onIceCandidate(CANDIDATE);
    first.events.onTrack(asMediaStream(new FakeStream()));
    first.events.onStateChange('connected');

    expect(call.sentOf('CANDIDATO')).toHaveLength(1);
    expect(call.state()).toMatchObject({ status: 'connecting', remoteStream: remote });
  });

  it('sigue el estado de la conexión y, si falla, vuelve a ofrecer', async () => {
    const call = setup('caller');
    call.session.receive({ type: 'LISTO', media: ALL_ON });
    await flush();
    const { events } = call.peer(0);

    events.onStateChange('connected');
    expect(call.state()?.status).toBe('connected');
    events.onStateChange('disconnected');
    expect(call.state()?.status).toBe('reconnecting');
    events.onStateChange('connecting');
    expect(call.state()?.status).toBe('reconnecting');

    events.onStateChange('failed');
    await flush();
    expect(call.peers).toHaveLength(2);
    expect(call.sentOf('OFERTA')).toHaveLength(2);
    expect(offerId(call, 1)).not.toBe(offerId(call, 0));
  });

  it('queda reconectando si la oferta o la respuesta no se pueden aplicar', async () => {
    const failingOffer = setup('caller', (peer) => peer.failing.add('createOffer'));
    failingOffer.session.receive({ type: 'LISTO', media: ALL_ON });
    await flush();
    expect(failingOffer.state()?.status).toBe('reconnecting');
    expect(failingOffer.sentOf('OFERTA')).toEqual([]);

    const failingAnswer = setup('caller', (peer) => peer.failing.add('setRemoteDescription'));
    failingAnswer.session.receive({ type: 'LISTO', media: ALL_ON });
    await flush();
    failingAnswer.session.receive({ type: 'RESPUESTA', id: offerId(failingAnswer), sdp: 'x' });
    await flush();
    expect(failingAnswer.state()?.status).toBe('reconnecting');
  });

  it('un candidato inválido no corta la llamada', async () => {
    const call = setup('caller', (peer) => peer.failing.add('addIceCandidate'));
    call.session.receive({ type: 'LISTO', media: ALL_ON });
    await flush();
    const id = offerId(call);
    call.session.receive({ type: 'RESPUESTA', id, sdp: 'x' });
    await flush();

    call.session.receive({ type: 'CANDIDATO', id, candidate: CANDIDATE });
    await flush();

    expect(call.state()?.status).toBe('connecting');
  });

  it('lo que termina tarde de una negociación anterior no se envía ni la marca como fallida', async () => {
    const call = setup('caller', (peer, index) => {
      if (index < 2) {
        peer.hold = 'createOffer';
      }
    });
    call.session.receive({ type: 'LISTO', media: ALL_ON });
    call.session.receive({ type: 'LISTO', media: ALL_ON });
    call.session.receive({ type: 'LISTO', media: ALL_ON });
    await flush();

    call.peer(0).held.get('createOffer')?.resolve();
    call.peer(1).held.get('createOffer')?.reject();
    await flush();

    expect(call.sentOf('OFERTA')).toHaveLength(1);
    expect(call.state()?.status).toBe('connecting');
  });

  it('ignora las ofertas (solo quien responde las recibe)', async () => {
    const call = setup('caller');

    call.session.receive({ type: 'OFERTA', id: 'x', sdp: 'x' });
    await flush();

    expect(call.peers).toEqual([]);
  });

  it('muestra el micrófono y la cámara de la otra persona, y la espera si sale', async () => {
    const call = setup('caller');
    call.session.receive({ type: 'LISTO', media: ALL_ON });
    await flush();
    call.peer(0).events.onTrack(asMediaStream(new FakeStream()));

    call.session.receive({ type: 'MEDIOS', media: { audio: false, video: false } });
    expect(call.state()?.remoteMedia).toEqual({ audio: false, video: false });

    call.session.receive({ type: 'SALIO' });
    expect(call.peer(0).closed).toBe(true);
    expect(call.state()).toMatchObject({ status: 'waiting', remoteStream: null });
  });

  it('al salir avisa una sola vez, cierra la conexión y deja de responder', async () => {
    const call = setup('caller');
    call.session.receive({ type: 'LISTO', media: ALL_ON });
    await flush();

    call.session.leave();
    call.session.leave();
    call.session.start();
    call.session.setMedia({ audio: false, video: true });
    call.session.receive({ type: 'LISTO', media: ALL_ON });
    await flush();

    expect(call.peer(0).closed).toBe(true);
    expect(call.peers).toHaveLength(1);
    expect(call.sent.map(({ type }) => type)).toEqual(['OFERTA', 'SALIO']);
  });

  it('envía una oferta vacía si el navegador no generó la descripción', async () => {
    const call = setup('caller', (peer) => {
      peer.withoutSdp = true;
    });

    call.session.receive({ type: 'LISTO', media: ALL_ON });
    await flush();

    expect(call.sentOf('OFERTA')[0]?.sdp).toBe('');
  });
});

describe('createCallSession · quien responde (empleado)', () => {
  it('confirma que está cuando quien llama saluda, con su estado actual', () => {
    const call = setup('callee');
    call.session.setMedia({ audio: false, video: true });

    call.session.receive({ type: 'LISTO', media: ALL_ON });

    expect(call.sentOf('LISTO')).toEqual([{ type: 'LISTO', media: { audio: false, video: true } }]);
    expect(call.peers).toEqual([]);
  });

  it('responde la oferta en su misma negociación y aplica los candidatos que la acompañan', async () => {
    const call = setup('callee');

    call.session.receive({ type: 'OFERTA', id: 'n-1', sdp: 'sdp-oferta' });
    call.session.receive({ type: 'CANDIDATO', id: 'n-1', candidate: CANDIDATE });
    await flush();
    call.peer(0).events.onIceCandidate(CANDIDATE);

    expect(call.peer(0).remote).toEqual([{ type: 'offer', sdp: 'sdp-oferta' }]);
    expect(call.peer(0).candidates).toEqual([CANDIDATE]);
    expect(call.sent).toEqual([
      { type: 'RESPUESTA', id: 'n-1', sdp: 'sdp-respuesta' },
      { type: 'CANDIDATO', id: 'n-1', candidate: CANDIDATE },
    ]);
  });

  it('ignora las respuestas (solo quien llama las recibe)', async () => {
    const call = setup('callee');
    call.session.receive({ type: 'OFERTA', id: 'n-1', sdp: 'x' });
    await flush();

    call.session.receive({ type: 'RESPUESTA', id: 'n-1', sdp: 'x' });
    await flush();

    expect(call.peer(0).remote).toHaveLength(1);
  });

  it('si la conexión falla, pide una oferta nueva', async () => {
    const call = setup('callee');
    call.session.receive({ type: 'OFERTA', id: 'n-1', sdp: 'x' });
    await flush();

    call.peer(0).events.onStateChange('failed');

    expect(call.sentOf('LISTO')).toHaveLength(1);
    expect(call.state()?.status).toBe('reconnecting');
  });

  it('queda reconectando si no puede responder, y descarta la respuesta a una oferta vieja', async () => {
    const failing = setup('callee', (peer) => peer.failing.add('createAnswer'));
    failing.session.receive({ type: 'OFERTA', id: 'n-1', sdp: 'x' });
    await flush();
    expect(failing.state()?.status).toBe('reconnecting');

    const late = setup('callee', (peer, index) => {
      if (index === 0) {
        peer.hold = 'createAnswer';
      }
      peer.withoutSdp = index === 1;
    });
    late.session.receive({ type: 'OFERTA', id: 'n-1', sdp: 'x' });
    await flush();
    late.session.receive({ type: 'OFERTA', id: 'n-2', sdp: 'y' });
    await flush();
    late.peer(0).held.get('createAnswer')?.resolve();
    await flush();

    expect(late.sentOf('RESPUESTA')).toEqual([{ type: 'RESPUESTA', id: 'n-2', sdp: '' }]);
  });
});
