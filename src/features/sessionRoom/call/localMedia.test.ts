import { describe, expect, it } from 'vitest';
import { asMediaStream, FakeStream, installCamera } from '@/test/webrtc';
import { mediaErrorReason, requestLocalMedia, stopMedia } from './localMedia';

describe('requestLocalMedia', () => {
  it('pide cámara (hasta 720p) y micrófono', async () => {
    const camera = installCamera();

    const stream = await requestLocalMedia();

    expect(camera.getUserMedia).toHaveBeenCalledWith({
      audio: true,
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    expect(stream).toBe(camera.granted[0]);
  });

  it('sin acceso a los dispositivos (página no segura) avisa que no hay soporte', async () => {
    const error: unknown = await requestLocalMedia().catch((caught: unknown) => caught);

    expect(mediaErrorReason(error)).toBe('unsupported');
  });
});

describe('mediaErrorReason', () => {
  it.each([
    ['NotAllowedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotFoundError', 'not-found'],
    ['OverconstrainedError', 'not-found'],
    ['NotReadableError', 'busy'],
    ['AbortError', 'busy'],
    ['NotSupportedError', 'unsupported'],
    ['TypeError', 'unknown'],
  ])('%s → %s', (name, reason) => {
    expect(mediaErrorReason(new DOMException('fallo', name))).toBe(reason);
  });

  it('cualquier otra cosa es un error desconocido', () => {
    expect(mediaErrorReason('fallo')).toBe('unknown');
  });
});

describe('stopMedia', () => {
  it('al salir detiene todas las pistas (se apaga la luz de la cámara)', () => {
    const stream = new FakeStream();

    stopMedia(asMediaStream(stream));

    expect(stream.getTracks().map((track) => track.readyState)).toEqual(['ended', 'ended']);
  });
});
