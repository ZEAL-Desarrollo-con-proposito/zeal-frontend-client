import { describe, expect, it } from 'vitest';
import { formatCountdown, formatDeadline, isFreedSlotOffer, remainingMs } from './freedSlot';

const OFFER = {
  id: 'cupo-1',
  psychologist: { id: 'usr-psicologo-001', fullName: 'Laura Martínez', title: 'Psicóloga clínica' },
  startsAt: new Date(2026, 8, 24, 8).toISOString(),
  endsAt: new Date(2026, 8, 24, 8, 50).toISOString(),
  expiresAt: new Date(2026, 8, 23, 9, 25).toISOString(),
};

describe('isFreedSlotOffer', () => {
  it('acepta un cupo con la forma del contrato', () => {
    expect(isFreedSlotOffer(OFFER)).toBe(true);
  });

  it.each([
    ['un valor que no es un objeto', 'cupo'],
    ['sin id', { ...OFFER, id: undefined }],
    ['sin psicólogo', { ...OFFER, psychologist: null }],
    ['con el psicólogo sin id', { ...OFFER, psychologist: { ...OFFER.psychologist, id: 1 } }],
    [
      'con el psicólogo sin nombre',
      { ...OFFER, psychologist: { ...OFFER.psychologist, fullName: 1 } },
    ],
    [
      'con el psicólogo sin título',
      { ...OFFER, psychologist: { ...OFFER.psychologist, title: 1 } },
    ],
    ['con un inicio que no es una fecha', { ...OFFER, startsAt: 'pronto' }],
    ['con un fin que no es una fecha', { ...OFFER, endsAt: 'luego' }],
    ['sin hora de vencimiento', { ...OFFER, expiresAt: undefined }],
  ])('rechaza un cupo %s', (_name, value) => {
    expect(isFreedSlotOffer(value)).toBe(false);
  });
});

describe('remainingMs', () => {
  const now = new Date(2026, 8, 23, 9, 20).getTime();

  it('cuenta lo que falta para que venza', () => {
    expect(remainingMs(OFFER, now)).toBe(5 * 60_000);
  });

  it('nunca es negativo una vez vencido', () => {
    expect(remainingMs(OFFER, now + 10 * 60_000)).toBe(0);
  });
});

describe('formatCountdown', () => {
  it.each([
    [5 * 60_000, '5:00'],
    [4 * 60_000 + 32_000, '4:32'],
    [61_000, '1:01'],
    [9_000, '0:09'],
    [8_200, '0:09'],
    [0, '0:00'],
  ])('%i ms → %s', (remaining, expected) => {
    expect(formatCountdown(remaining)).toBe(expected);
  });
});

describe('formatDeadline', () => {
  it('muestra la hora límite en reloj de 24 h', () => {
    expect(formatDeadline(OFFER)).toBe('9:25');
  });
});
