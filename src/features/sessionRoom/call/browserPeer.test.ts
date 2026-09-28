import { describe, expect, it, vi } from 'vitest';
import { asMediaStream, FakeStream, FakeTrack, installPeerConnection } from '@/test/webrtc';
import { browserPeerFactory } from './browserPeer';

function connect() {
  const peers = installPeerConnection();
  const events = { onIceCandidate: vi.fn(), onTrack: vi.fn(), onStateChange: vi.fn() };
  const peer = browserPeerFactory([{ urls: 'stun:stun.zeal.co:3478' }])(events);
  return { peer, native: peers.last(), events };
}

describe('browserPeerFactory', () => {
  it('abre la conexión con los servidores ICE que dio el servidor', () => {
    const { native } = connect();

    expect(native.config).toEqual({ iceServers: [{ urls: 'stun:stun.zeal.co:3478' }] });
  });

  it('traduce los eventos del navegador a la llamada', () => {
    const { native, events } = connect();
    const stream = asMediaStream(new FakeStream());

    native.emitCandidate({ candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0 });
    native.emitCandidate(null);
    native.emitTrack([stream]);
    native.emitTrack([]);
    native.setState('connected');

    expect(events.onIceCandidate).toHaveBeenCalledExactlyOnceWith({
      candidate: 'candidate:1',
      sdpMid: '0',
      sdpMLineIndex: 0,
    });
    expect(events.onTrack).toHaveBeenCalledExactlyOnceWith(stream);
    expect(events.onStateChange).toHaveBeenCalledExactlyOnceWith('connected');
  });

  it('delega la negociación en RTCPeerConnection', async () => {
    const { peer, native } = connect();
    const track = new FakeTrack('audio') as unknown as MediaStreamTrack;
    const candidate = { candidate: 'candidate:2', sdpMid: '0', sdpMLineIndex: 0 };

    peer.addTrack(track, asMediaStream(new FakeStream()));
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await peer.setRemoteDescription({ type: 'answer', sdp: 'respuesta' });
    await peer.addIceCandidate(candidate);
    const answer = await peer.createAnswer();
    peer.close();

    expect(native.tracks).toEqual([track]);
    expect(offer).toEqual({ type: 'offer', sdp: 'oferta-1' });
    expect(answer).toEqual({ type: 'answer', sdp: 'respuesta-1' });
    expect(native.localDescription).toEqual(offer);
    expect(native.remoteDescription).toEqual({ type: 'answer', sdp: 'respuesta' });
    expect(native.candidates).toEqual([candidate]);
    expect(native.closed).toBe(true);
  });
});
