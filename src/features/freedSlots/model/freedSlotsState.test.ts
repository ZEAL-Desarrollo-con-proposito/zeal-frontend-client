import { describe, expect, it } from 'vitest';
import type { FreedSlotOffer } from './freedSlot';
import type { FreedSlotsAction, OfferEntry } from './freedSlotsState';
import {
  freedSlotsReducer,
  INITIAL_FREED_SLOTS_STATE,
  MAX_VISIBLE_OFFERS,
} from './freedSlotsState';

function offer(id: string): FreedSlotOffer {
  return {
    id,
    psychologist: {
      id: 'usr-psicologo-001',
      fullName: 'Laura Martínez',
      title: 'Psicóloga clínica',
    },
    startsAt: new Date(2026, 8, 24, 8).toISOString(),
    endsAt: new Date(2026, 8, 24, 8, 50).toISOString(),
    expiresAt: new Date(2026, 8, 23, 9, 25).toISOString(),
  };
}

function run(...actions: FreedSlotsAction[]): readonly OfferEntry[] {
  return actions.reduce(freedSlotsReducer, INITIAL_FREED_SLOTS_STATE);
}

const claimStatus = (state: readonly OfferEntry[], index = 0) => state[index]?.claim;

describe('freedSlotsReducer', () => {
  it('un cupo nuevo llega disponible', () => {
    expect(run({ type: 'offered', offer: offer('a') })).toEqual([
      { offer: offer('a'), claim: { status: 'available', error: null } },
    ]);
  });

  it(`muestra como máximo ${String(MAX_VISIBLE_OFFERS)} alertas: la más antigua sale`, () => {
    const state = run(
      { type: 'offered', offer: offer('a') },
      { type: 'offered', offer: offer('b') },
      { type: 'offered', offer: offer('c') },
      { type: 'offered', offer: offer('d') },
    );

    expect(state.map(({ offer: { id } }) => id)).toEqual(['b', 'c', 'd']);
  });

  it('el primer clic pasa a "tomando" y solo desde disponible', () => {
    const claiming = run({ type: 'offered', offer: offer('a') }, { type: 'claim-start', id: 'a' });
    expect(claimStatus(claiming)).toEqual({ status: 'claiming' });

    // Un segundo inicio no cambia nada: ya se está tomando.
    expect(freedSlotsReducer(claiming, { type: 'claim-start', id: 'a' })).toEqual(claiming);
  });

  it('gana el cupo', () => {
    const state = run(
      { type: 'offered', offer: offer('a') },
      { type: 'claim-start', id: 'a' },
      { type: 'claim-won', id: 'a' },
    );
    expect(claimStatus(state)).toEqual({ status: 'won' });
  });

  it('pierde el cupo porque otra persona lo tomó primero, con la explicación del servidor', () => {
    const state = run(
      { type: 'offered', offer: offer('a') },
      { type: 'claim-start', id: 'a' },
      { type: 'claim-lost', id: 'a', detail: 'Otra persona tomó este cupo antes que tú.' },
    );
    expect(claimStatus(state)).toEqual({
      status: 'lost',
      detail: 'Otra persona tomó este cupo antes que tú.',
    });
  });

  it('el cupo ya no existe o venció', () => {
    const state = run(
      { type: 'offered', offer: offer('a') },
      { type: 'claim-start', id: 'a' },
      { type: 'claim-gone', id: 'a', detail: undefined },
    );
    expect(claimStatus(state)).toEqual({ status: 'gone', detail: undefined });
  });

  it('si la conexión falla vuelve a estar disponible, con el motivo', () => {
    const state = run(
      { type: 'offered', offer: offer('a') },
      { type: 'claim-start', id: 'a' },
      { type: 'claim-failed', id: 'a', error: 'Sin conexión' },
    );
    expect(claimStatus(state)).toEqual({ status: 'available', error: 'Sin conexión' });
  });

  it('si otra persona lo toma mientras se mira, pasa a perdido al instante', () => {
    const state = run({ type: 'offered', offer: offer('a') }, { type: 'taken', id: 'a' });
    expect(claimStatus(state)).toEqual({ status: 'lost', detail: undefined });
  });

  it('si al reconectar el servidor ya no lo ofrece, pasa a "ya no está disponible"', () => {
    const state = run({ type: 'offered', offer: offer('a') }, { type: 'closed', id: 'a' });
    expect(claimStatus(state)).toEqual({ status: 'gone', detail: undefined });
  });

  it.each([
    ['tomado', 'mientras se toma', 'taken', 'claim-start'],
    ['tomado', 'después de ganarlo', 'taken', 'claim-won'],
    ['cerrado al reconectar', 'mientras se toma', 'closed', 'claim-start'],
    ['cerrado al reconectar', 'después de ganarlo', 'closed', 'claim-won'],
  ] as const)('un aviso de "%s" %s no cambia el resultado', (_notice, _moment, type, last) => {
    const state = run(
      { type: 'offered', offer: offer('a') },
      { type: 'claim-start', id: 'a' },
      ...(last === 'claim-won' ? [{ type: 'claim-won', id: 'a' } as const] : []),
    );

    expect(freedSlotsReducer(state, { type, id: 'a' })).toEqual(state);
  });

  it('un resultado atrasado no pisa otro estado ni afecta a otros cupos', () => {
    const state = run(
      { type: 'offered', offer: offer('a') },
      { type: 'offered', offer: offer('b') },
      { type: 'claim-start', id: 'a' },
    );

    // "b" sigue disponible: un resultado de "a" no lo toca; y "b" no estaba tomándose.
    expect(freedSlotsReducer(state, { type: 'claim-won', id: 'b' })).toEqual(state);
    expect(claimStatus(freedSlotsReducer(state, { type: 'claim-won', id: 'a' }), 1)).toEqual({
      status: 'available',
      error: null,
    });
  });

  it('cierra una alerta sin afectar a las demás', () => {
    const state = run(
      { type: 'offered', offer: offer('a') },
      { type: 'offered', offer: offer('b') },
      { type: 'dismiss', id: 'a' },
    );
    expect(state.map(({ offer: { id } }) => id)).toEqual(['b']);
  });
});
