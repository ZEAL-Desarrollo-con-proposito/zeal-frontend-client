import { describe, expect, it } from 'vitest';
import type { WorkshopRoom } from './workshopRoom';
import { isRoomWindow, isWorkshopRoom, workshopRoomPhase } from './workshopRoom';

const OPEN: WorkshopRoom = {
  workshopId: 'taller-1',
  title: 'Pausas activas',
  startsAt: '2026-09-23T15:00:00.000Z',
  endsAt: '2026-09-23T16:00:00.000Z',
  opensAt: '2026-09-23T14:50:00.000Z',
  status: 'ABIERTA',
  role: 'PARTICIPANTE',
  enrolled: 12,
  connection: { serverUrl: '/livekit', token: 'permiso' },
};
const at = (iso: string) => Date.parse(iso);

describe('isWorkshopRoom', () => {
  it('acepta la sala abierta con su conexión y la programada sin ella', () => {
    expect(isWorkshopRoom(OPEN)).toBe(true);
    expect(isWorkshopRoom({ ...OPEN, status: 'PROGRAMADA', connection: null })).toBe(true);
  });

  it.each([
    ['no es un objeto', null],
    ['sin taller', { ...OPEN, workshopId: 7 }],
    ['sin título', { ...OPEN, title: undefined }],
    ['con fechas inválidas', { ...OPEN, startsAt: 'mañana' }],
    ['sin fin', { ...OPEN, endsAt: undefined }],
    ['sin apertura', { ...OPEN, opensAt: 'pronto' }],
    ['con un estado desconocido', { ...OPEN, status: 'ACTIVA' }],
    ['con un rol desconocido', { ...OPEN, role: 'ADMIN' }],
    ['sin inscritos', { ...OPEN, enrolled: '12' }],
    ['con una conexión incompleta', { ...OPEN, connection: { serverUrl: '/livekit' } }],
    ['abierta sin conexión', { ...OPEN, connection: null }],
  ])('rechaza una sala %s', (_, value) => {
    expect(isWorkshopRoom(value)).toBe(false);
  });
});

describe('workshopRoomPhase', () => {
  it('programada: muestra la hora de apertura hasta que llega', () => {
    const scheduled = { ...OPEN, status: 'PROGRAMADA' as const, connection: null };
    expect(workshopRoomPhase(scheduled, at('2026-09-23T14:00:00Z'))).toEqual({
      kind: 'upcoming',
      opensAt: new Date(OPEN.opensAt),
    });
    expect(workshopRoomPhase(scheduled, at(OPEN.opensAt))).toEqual({ kind: 'stale' });
  });

  it('abierta: entrega la conexión mientras dura el taller; al terminar hay que volver a pedirla', () => {
    expect(workshopRoomPhase(OPEN, at('2026-09-23T15:30:00Z'))).toEqual({
      kind: 'open',
      connection: OPEN.connection,
    });
    expect(workshopRoomPhase(OPEN, at(OPEN.endsAt))).toEqual({ kind: 'stale' });
  });

  it('finalizada: ya no se puede entrar', () => {
    expect(workshopRoomPhase({ ...OPEN, status: 'FINALIZADA', connection: null }, 0)).toEqual({
      kind: 'finished',
    });
  });
});

describe('isRoomWindow', () => {
  const workshop = { startsAt: '2026-09-23T15:00:00.000Z', durationMinutes: 60 };

  it('abarca desde 10 minutos antes del inicio hasta el final del taller', () => {
    expect(isRoomWindow(workshop, at('2026-09-23T14:49:59Z'))).toBe(false);
    expect(isRoomWindow(workshop, at('2026-09-23T14:50:00Z'))).toBe(true);
    expect(isRoomWindow(workshop, at('2026-09-23T15:59:59Z'))).toBe(true);
    expect(isRoomWindow(workshop, at('2026-09-23T16:00:00Z'))).toBe(false);
  });
});
