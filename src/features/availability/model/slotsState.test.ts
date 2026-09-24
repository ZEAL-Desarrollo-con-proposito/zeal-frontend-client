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

    expect(ready).toEqual({ requestId: 1, status: 'ready', slots: [slotA] });
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
});
