import type { LoadStatus } from '@/shared/hooks/useFetch';
import type { Slot } from './slot';
import type { SlotEvent } from './slotEvent';

export interface SlotsState {
  /** Carga vigente: solo sus resultados se aplican (la última petición gana). */
  requestId: number;
  status: LoadStatus;
  slots: Slot[];
  /** Eventos recibidos durante la carga: se reaplican sobre la foto que devuelva el servidor. */
  pendingEvents: SlotEvent[];
  /** Franjas eliminadas: un evento o respuesta atrasada nunca las "revive" (los ids no se reusan). */
  deletedIds: string[];
}

export type SlotsAction =
  | { type: 'load-start'; requestId: number }
  | { type: 'load-success'; requestId: number; slots: Slot[] }
  | { type: 'load-failure'; requestId: number }
  | { type: 'created'; slot: Slot }
  | { type: 'removed'; id: string }
  | { type: 'event'; event: SlotEvent };

export const INITIAL_SLOTS_STATE: SlotsState = {
  requestId: 0,
  status: 'loading',
  slots: [],
  pendingEvents: [],
  deletedIds: [],
};

/** Inserta o reemplaza por id: aplicar dos veces la misma franja no la duplica. */
function upsert(state: SlotsState, slot: Slot): SlotsState {
  if (state.deletedIds.includes(slot.id)) {
    return state;
  }
  return { ...state, slots: [...state.slots.filter(({ id }) => id !== slot.id), slot] };
}

function remove(state: SlotsState, id: string): SlotsState {
  return {
    ...state,
    slots: state.slots.filter((slot) => slot.id !== id),
    deletedIds: state.deletedIds.includes(id) ? state.deletedIds : [...state.deletedIds, id],
  };
}

function applyEvent(state: SlotsState, event: SlotEvent): SlotsState {
  return event.type === 'ELIMINADA' ? remove(state, event.slot.id) : upsert(state, event.slot);
}

export function slotsReducer(state: SlotsState, action: SlotsAction): SlotsState {
  switch (action.type) {
    case 'load-start':
      return { ...state, requestId: action.requestId, status: 'loading', pendingEvents: [] };
    case 'load-success':
      if (action.requestId !== state.requestId) {
        return state;
      }
      return state.pendingEvents.reduce(applyEvent, {
        ...state,
        status: 'ready',
        pendingEvents: [],
        slots: action.slots.filter(({ id }) => !state.deletedIds.includes(id)),
      });
    case 'load-failure':
      return action.requestId === state.requestId ? { ...state, status: 'error' } : state;
    case 'created':
      return upsert(state, action.slot);
    case 'removed':
      return remove(state, action.id);
    case 'event': {
      const next = applyEvent(state, action.event);
      return state.status === 'loading'
        ? { ...next, pendingEvents: [...state.pendingEvents, action.event] }
        : next;
    }
  }
}
