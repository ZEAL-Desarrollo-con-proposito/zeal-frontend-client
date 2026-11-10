import { describe, expect, it } from 'vitest';
import type { CallParticipant } from './videoCall';
import { isVideoConnection, participantLabel, resolveServerUrl } from './videoCall';

const person: CallParticipant = {
  id: 'usr-empleado-001',
  name: 'David Cajamarca',
  host: false,
  self: false,
  stream: null,
  media: { audio: true, video: true },
  speaking: false,
};

describe('participantLabel', () => {
  it('rotula a uno mismo como "Tú" y a quien recibe como anfitrión', () => {
    expect(participantLabel(person)).toBe('David Cajamarca');
    expect(participantLabel({ ...person, self: true })).toBe('Tú');
    expect(participantLabel({ ...person, host: true, name: 'Talento Humano' })).toBe(
      'Talento Humano · Anfitrión',
    );
    expect(participantLabel({ ...person, host: true, self: true })).toBe('Tú · Anfitrión');
  });
});

describe('resolveServerUrl', () => {
  it('resuelve una ruta relativa contra el API Gateway y usa WebSocket', () => {
    expect(resolveServerUrl('/livekit', 'http://localhost:8080')).toBe(
      'ws://localhost:8080/livekit',
    );
    expect(resolveServerUrl('/livekit', 'https://zeal.co')).toBe('wss://zeal.co/livekit');
  });

  it('respeta una URL absoluta', () => {
    expect(resolveServerUrl('wss://video.zeal.co/', 'http://localhost:8080')).toBe(
      'wss://video.zeal.co',
    );
    expect(resolveServerUrl('ws://127.0.0.1:7880', 'https://zeal.co')).toBe('ws://127.0.0.1:7880');
  });
});

describe('isVideoConnection', () => {
  it('acepta la dirección del servidor de video con su permiso', () => {
    expect(isVideoConnection({ serverUrl: '/livekit', token: 'jwt' })).toBe(true);
  });

  it.each([
    ['sin cuerpo', null],
    ['sin permiso', { serverUrl: '/livekit' }],
    ['sin dirección', { token: 'jwt' }],
    ['con tipos equivocados', { serverUrl: 7, token: 'jwt' }],
  ])('rechaza una conexión %s', (_case, value) => {
    expect(isVideoConnection(value)).toBe(false);
  });
});
