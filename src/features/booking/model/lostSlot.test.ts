import { describe, expect, it } from 'vitest';
import type { Slot } from '@/features/availability/model/slot';
import { isSlotLost, lostSlotMessage } from './lostSlot';

const slot: Slot = {
  id: 'franja-1',
  psychologistId: 'usr-psicologo-001',
  startsAt: new Date(2026, 8, 23, 14).toISOString(),
  endsAt: new Date(2026, 8, 23, 14, 50).toISOString(),
  status: 'DISPONIBLE',
};

describe('bloque perdido', () => {
  it('se pierde si lo reservan o lo retiran, no si sigue libre', () => {
    expect(isSlotLost({ type: 'ACTUALIZADA', slot: { ...slot, status: 'RESERVADA' } })).toBe(true);
    expect(isSlotLost({ type: 'ELIMINADA', slot })).toBe(true);
    expect(isSlotLost({ type: 'ACTUALIZADA', slot })).toBe(false);
    expect(isSlotLost({ type: 'CREADA', slot })).toBe(false);
  });

  it('explica qué pasó y qué hacer', () => {
    expect(lostSlotMessage({ type: 'ACTUALIZADA', slot: { ...slot, status: 'RESERVADA' } })).toBe(
      'Otra persona acaba de reservar el bloque que elegiste. Elige otro bloque libre.',
    );
    expect(lostSlotMessage({ type: 'ELIMINADA', slot })).toBe(
      'El psicólogo retiró el bloque que elegiste. Elige otro bloque libre.',
    );
  });
});
