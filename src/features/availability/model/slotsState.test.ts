import { describe, expect, it } from 'vitest';
import type { Slot } from './slot';
import { INITIAL_SLOTS_STATE, slotsReducer } from './slotsState';

const slotA: Slot = {
  id: 'a',
  psychologistId: 'psi-1',
  startsAt: '2026-09-23T13:00:00.000Z',
  endsAt: '2026-09-23T13:50:00.000Z',
  status: 'DISPONIBLE',
};

describe('slotsReducer', () => {
  it('aplica el resultado de la carga vigente', () => {
    const loading = slotsReducer(INITIAL_SLOTS_STATE, { type: 'load-start', requestId: 1 });
    const ready = slotsReducer(loading, { type: 'load-success', requestId: 1, slots: [slotA] });

    expect(ready).toMatchObject({ requestId: 1, status: 'ready', slots: [slotA] });
  });

  it('descarta respuestas de cargas anteriores (la última petición gana)', () => {
    const first = slotsReducer(INITIAL_SLOTS_STATE, { type: 'load-start', requestId: 1 });
    const second = slotsReducer(first, { type: 'load-start', requestId: 2 });

    const staleSuccess = slotsReducer(second, {
      type: 'load-success',
      requestId: 1,
      slots: [slotA],
    });
    const staleFailure = slotsReducer(second, { type: 'load-failure', requestId: 1 });

    expect(staleSuccess).toBe(second);
    expect(staleFailure).toBe(second);
  });

  it('marca el error solo de la carga vigente', () => {
    const loading = slotsReducer(INITIAL_SLOTS_STATE, { type: 'load-start', requestId: 3 });

    expect(slotsReducer(loading, { type: 'load-failure', requestId: 3 }).status).toBe('error');
  });

  it('reaplica sobre la foto del servidor los eventos que llegan mientras carga', () => {
    const slotB = { ...slotA, id: 'b' };
    const loading = slotsReducer(INITIAL_SLOTS_STATE, { type: 'load-start', requestId: 1 });
    const withEvents = [
      { type: 'CREADA' as const, slot: slotB },
      { type: 'ELIMINADA' as const, slot: slotA },
    ].reduce((state, event) => slotsReducer(state, { type: 'event', event }), loading);

    const ready = slotsReducer(withEvents, { type: 'load-success', requestId: 1, slots: [slotA] });

    expect(ready.slots).toEqual([slotB]);
    expect(ready.pendingEvents).toEqual([]);
  });

  it('una franja eliminada no revive por respuestas o eventos atrasados', () => {
    const ready = slotsReducer(
      slotsReducer(INITIAL_SLOTS_STATE, { type: 'load-start', requestId: 1 }),
      { type: 'load-success', requestId: 1, slots: [slotA] },
    );
    const removed = slotsReducer(ready, { type: 'removed', id: 'a' });

    const late = [
      slotsReducer(removed, { type: 'created', slot: slotA }),
      slotsReducer(removed, { type: 'event', event: { type: 'ACTUALIZADA', slot: slotA } }),
      slotsReducer(removed, { type: 'event', event: { type: 'ELIMINADA', slot: slotA } }),
      slotsReducer(slotsReducer(removed, { type: 'load-start', requestId: 2 }), {
        type: 'load-success',
        requestId: 2,
        slots: [slotA],
      }),
    ];

    expect(late.map((state) => state.slots)).toEqual([[], [], [], []]);
  });

  it('un evento de actualización reemplaza la franja sin duplicarla', () => {
    const ready = slotsReducer(
      slotsReducer(INITIAL_SLOTS_STATE, { type: 'load-start', requestId: 1 }),
      { type: 'load-success', requestId: 1, slots: [slotA] },
    );
    const reserved = { ...slotA, status: 'RESERVADA' as const };

    const next = slotsReducer(ready, {
      type: 'event',
      event: { type: 'ACTUALIZADA', slot: reserved },
    });

    expect(next.slots).toEqual([reserved]);
    expect(next.pendingEvents).toEqual([]);
  });
});
