import { describe, expect, it } from 'vitest';
import { isRoomEvent } from './roomEvent';

describe('isRoomEvent', () => {
  it('reconoce el aviso de que la sala cambió', () => {
    expect(isRoomEvent({ type: 'SALA_ACTUALIZADA', reservationId: 'reserva-16' })).toBe(true);
  });

  it.each<[string, unknown]>([
    ['un valor que no es objeto', 'SALA_ACTUALIZADA'],
    ['sin la reserva', { type: 'SALA_ACTUALIZADA' }],
    ['una reserva que no es texto', { type: 'SALA_ACTUALIZADA', reservationId: 16 }],
    ['una señal del video anterior (WebRTC)', { type: 'SENAL', reservationId: 'reserva-16' }],
  ])('descarta %s', (_case, value) => {
    expect(isRoomEvent(value)).toBe(false);
  });
});
