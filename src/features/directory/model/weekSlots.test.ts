import { describe, expect, it } from 'vitest';
import type { Slot } from '@/features/availability/model/slot';
import { freeSlotNotice, isBookable, upcomingSlots } from './weekSlots';

const at = (hour: number, minute = 0) => new Date(2026, 8, 23, hour, minute);

function slot(id: string, hour: number, status: Slot['status'] = 'DISPONIBLE'): Slot {
  return {
    id,
    psychologistId: 'usr-psicologo-001',
    startsAt: at(hour).toISOString(),
    endsAt: at(hour, 50).toISOString(),
    status,
  };
}

describe('upcomingSlots', () => {
  it('deja los bloques que aún no empiezan, libres u ocupados, en orden', () => {
    const slots = [
      slot('tarde', 15),
      slot('ocupado', 11, 'RESERVADA'),
      slot('ya', 9),
      slot('pronto', 10),
    ];

    expect(upcomingSlots(slots, at(9, 20).getTime()).map(({ id }) => id)).toEqual([
      'pronto',
      'ocupado',
      'tarde',
    ]);
  });
});

describe('isBookable', () => {
  it('solo un bloque libre se puede elegir', () => {
    expect(isBookable(slot('libre', 10))).toBe(true);
    expect(isBookable(slot('ocupado', 10, 'RESERVADA'))).toBe(false);
  });
});

describe('freeSlotNotice', () => {
  const when = 'miércoles, 23 de septiembre de 14:00 a 14:50';

  it.each([
    ['CREADA', 'DISPONIBLE', `Se abrió un bloque nuevo el ${when}.`],
    ['ELIMINADA', 'DISPONIBLE', `Se retiró el bloque del ${when}.`],
    ['ACTUALIZADA', 'RESERVADA', `Alguien acaba de reservar el bloque del ${when}.`],
    ['ACTUALIZADA', 'DISPONIBLE', `Se liberó el bloque del ${when}.`],
  ] as const)('avisa un evento %s de un bloque %s', (type, status, message) => {
    expect(freeSlotNotice({ type, slot: slot('franja', 14, status) })).toBe(message);
  });
});
