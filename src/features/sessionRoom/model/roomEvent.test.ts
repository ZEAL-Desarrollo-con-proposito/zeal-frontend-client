import { describe, expect, it } from 'vitest';
import { isRoomEvent, isSignal, signalDestination } from './roomEvent';

const CANDIDATE = { candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0 };
const MEDIA = { audio: true, video: false };

describe('isSignal', () => {
  it.each<[string, unknown]>([
    ['LISTO', { type: 'LISTO', media: MEDIA }],
    ['MEDIOS', { type: 'MEDIOS', media: MEDIA }],
    ['OFERTA', { type: 'OFERTA', id: 'n-1', sdp: 'v=0' }],
    ['RESPUESTA', { type: 'RESPUESTA', id: 'n-1', sdp: 'v=0' }],
    ['CANDIDATO', { type: 'CANDIDATO', id: 'n-1', candidate: CANDIDATE }],
    [
      'CANDIDATO sin línea',
      {
        type: 'CANDIDATO',
        id: 'n-1',
        candidate: { candidate: '', sdpMid: null, sdpMLineIndex: null },
      },
    ],
    ['SALIO', { type: 'SALIO' }],
  ])('acepta %s', (_case, value) => {
    expect(isSignal(value)).toBe(true);
  });

  it.each<[string, unknown]>([
    ['un valor que no es objeto', 'LISTO'],
    ['un tipo desconocido', { type: 'COLGAR' }],
    ['un estado de medios incompleto', { type: 'LISTO', media: { audio: true } }],
    ['una oferta sin negociación', { type: 'OFERTA', sdp: 'v=0' }],
    ['una respuesta sin descripción', { type: 'RESPUESTA', id: 'n-1' }],
    ['un candidato sin negociación', { type: 'CANDIDATO', candidate: CANDIDATE }],
    ['un candidato mal formado', { type: 'CANDIDATO', id: 'n-1', candidate: { candidate: 1 } }],
    [
      'un candidato con sdpMid inválido',
      { type: 'CANDIDATO', id: 'n-1', candidate: { ...CANDIDATE, sdpMid: 0 } },
    ],
    [
      'un candidato con índice inválido',
      { type: 'CANDIDATO', id: 'n-1', candidate: { ...CANDIDATE, sdpMLineIndex: '0' } },
    ],
  ])('rechaza %s', (_case, value) => {
    expect(isSignal(value)).toBe(false);
  });
});

describe('isRoomEvent', () => {
  it('acepta los avisos de la sala y las señales válidas', () => {
    expect(isRoomEvent({ type: 'SALA_ACTUALIZADA', reservationId: 'reserva-1' })).toBe(true);
    expect(
      isRoomEvent({ type: 'SENAL', reservationId: 'reserva-1', signal: { type: 'SALIO' } }),
    ).toBe(true);
  });

  it('rechaza lo que no es de una sala o trae una señal inválida', () => {
    expect(isRoomEvent(null)).toBe(false);
    expect(isRoomEvent({ type: 'SALA_ACTUALIZADA' })).toBe(false);
    expect(isRoomEvent({ type: 'SALA_BORRADA', reservationId: 'reserva-1' })).toBe(false);
    expect(isRoomEvent({ type: 'SENAL', reservationId: 'reserva-1', signal: { type: 'X' } })).toBe(
      false,
    );
  });
});

describe('signalDestination', () => {
  it('codifica la reserva en el destino de la señalización', () => {
    expect(signalDestination('reserva-16')).toBe('/app/salas/reserva-16/senales');
    expect(signalDestination('a/b')).toBe('/app/salas/a%2Fb/senales');
  });
});
