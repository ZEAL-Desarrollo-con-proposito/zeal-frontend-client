import { describe, expect, it } from 'vitest';
import { FREED_SLOTS_QUEUE, isFreedSlotEvent } from './freedSlotEvent';

const OFFER = {
  id: 'cupo-1',
  psychologist: { id: 'usr-psicologo-001', fullName: 'Laura Martínez', title: 'Psicóloga clínica' },
  startsAt: new Date(2026, 8, 24, 8).toISOString(),
  endsAt: new Date(2026, 8, 24, 8, 50).toISOString(),
  expiresAt: new Date(2026, 8, 23, 9, 25).toISOString(),
};

describe('isFreedSlotEvent', () => {
  it('llega por la cola privada de la persona', () => {
    expect(FREED_SLOTS_QUEUE).toBe('/user/queue/cupos-liberados');
  });

  it('acepta un cupo liberado', () => {
    expect(isFreedSlotEvent({ type: 'LIBERADO', offer: OFFER })).toBe(true);
  });

  it('acepta que otra persona tomó el cupo', () => {
    expect(isFreedSlotEvent({ type: 'TOMADO', offerId: 'cupo-1' })).toBe(true);
  });

  it.each([
    ['un texto', 'LIBERADO'],
    ['nulo', null],
    ['un tipo desconocido', { type: 'BORRADO', offerId: 'cupo-1' }],
    ['un cupo liberado sin cupo', { type: 'LIBERADO' }],
    ['un cupo liberado con un cupo mal formado', { type: 'LIBERADO', offer: { id: 'cupo-1' } }],
    ['un cupo tomado sin id', { type: 'TOMADO' }],
    ['un cupo tomado con un id que no es texto', { type: 'TOMADO', offerId: 7 }],
  ])('rechaza %s', (_name, value) => {
    expect(isFreedSlotEvent(value)).toBe(false);
  });
});
