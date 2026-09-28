import { describe, expect, it } from 'vitest';
import type { Room } from './room';
import { isRoom, roomBadge, roomPhase } from './room';

const at = (hour: number, minute = 0) => new Date(2026, 8, 23, hour, minute).getTime();

const ROOM: Room = {
  reservationId: 'reserva-16',
  status: 'PROGRAMADA',
  startsAt: new Date(at(9)).toISOString(),
  endsAt: new Date(at(9, 50)).toISOString(),
  opensAt: new Date(at(8, 50)).toISOString(),
  closesAt: new Date(at(9, 50)).toISOString(),
  participant: { id: 'usr-empleado-001', fullName: 'David Cajamarca' },
  iceServers: [
    { urls: 'stun:stun.zeal.co' },
    { urls: ['turn:turn.zeal.co'], username: 'u', credential: 'c' },
  ],
};

describe('isRoom', () => {
  it('acepta la sala del contrato', () => {
    expect(isRoom(ROOM)).toBe(true);
    expect(isRoom({ ...ROOM, iceServers: [] })).toBe(true);
  });

  it.each<[string, unknown]>([
    ['un valor que no es objeto', 'sala'],
    ['un estado desconocido', { ...ROOM, status: 'ABIERTA' }],
    ['una fecha inválida', { ...ROOM, opensAt: 'mañana' }],
    ['sin la otra persona', { ...ROOM, participant: null }],
    ['un nombre que no es texto', { ...ROOM, participant: { id: 'x', fullName: 3 } }],
    ['servidores ICE que no son lista', { ...ROOM, iceServers: {} }],
    ['un servidor ICE sin urls', { ...ROOM, iceServers: [{}] }],
    ['urls que no son texto', { ...ROOM, iceServers: [{ urls: [1] }] }],
    ['un usuario TURN que no es texto', { ...ROOM, iceServers: [{ urls: 'turn:x', username: 1 }] }],
    [
      'una clave TURN que no es texto',
      { ...ROOM, iceServers: [{ urls: 'turn:x', credential: 1 }] },
    ],
  ])('rechaza %s', (_case, value) => {
    expect(isRoom(value)).toBe(false);
  });
});

describe('roomPhase', () => {
  it('antes de la ventana dice cuándo abre', () => {
    expect(roomPhase(ROOM, at(8, 30))).toEqual({ kind: 'upcoming', opensAt: new Date(at(8, 50)) });
  });

  it('dentro de la ventana depende de si el psicólogo ya la activó', () => {
    expect(roomPhase(ROOM, at(8, 55))).toEqual({ kind: 'scheduled' });
    expect(roomPhase({ ...ROOM, status: 'ACTIVA' }, at(9, 10))).toEqual({ kind: 'active' });
  });

  it('después de la ventana está cerrada', () => {
    expect(roomPhase({ ...ROOM, status: 'ACTIVA' }, at(9, 51))).toEqual({ kind: 'closed' });
  });

  it('una sesión cancelada o finalizada no tiene sala, sin importar la hora', () => {
    expect(roomPhase({ ...ROOM, status: 'CANCELADA' }, at(9))).toEqual({ kind: 'cancelled' });
    expect(roomPhase({ ...ROOM, status: 'FINALIZADA' }, at(9))).toEqual({ kind: 'finished' });
  });
});

describe('roomBadge', () => {
  it('lee "En curso" con el reloj y, si no, el estado del servidor', () => {
    expect(roomBadge(ROOM, at(9, 10))).toEqual({ label: 'En curso', tone: 'teal' });
    expect(roomBadge(ROOM, at(8, 55))).toEqual({ label: 'Confirmada', tone: 'sage' });
    expect(roomBadge(ROOM, at(9, 50))).toEqual({ label: 'Confirmada', tone: 'sage' });
    expect(roomBadge({ ...ROOM, status: 'CANCELADA' }, at(9, 10))).toEqual({
      label: 'Cancelada',
      tone: 'coral',
    });
    expect(roomBadge({ ...ROOM, status: 'FINALIZADA' }, at(9, 10))).toEqual({
      label: 'Finalizada',
      tone: 'neutral',
    });
  });
});
