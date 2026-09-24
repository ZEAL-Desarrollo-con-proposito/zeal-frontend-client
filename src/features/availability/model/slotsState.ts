import type { Slot } from './slot';

export type LoadStatus = 'loading' | 'ready' | 'error';

export interface SlotsState {
  /** Carga vigente: solo sus resultados se aplican (la última petición gana). */
  requestId: number;
  status: LoadStatus;
  slots: Slot[];
}

export type SlotsAction =
  | { type: 'load-start'; requestId: number }
  | { type: 'load-success'; requestId: number; slots: Slot[] }
  | { type: 'load-failure'; requestId: number };

export const INITIAL_SLOTS_STATE: SlotsState = { requestId: 0, status: 'loading', slots: [] };

export function slotsReducer(state: SlotsState, action: SlotsAction): SlotsState {
  switch (action.type) {
    case 'load-start':
      return { ...state, requestId: action.requestId, status: 'loading' };
    case 'load-success':
      return action.requestId === state.requestId
        ? { ...state, status: 'ready', slots: action.slots }
        : state;
    case 'load-failure':
      return action.requestId === state.requestId ? { ...state, status: 'error' } : state;
  }
}
