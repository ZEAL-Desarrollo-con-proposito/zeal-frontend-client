import type { LoadStatus } from '@/shared/hooks/useFetch';

/** Elemento que el servidor versiona: con cada cambio sube `version`. */
export interface Versioned {
  id: string;
  version: number;
}

export interface LiveCollectionState<T> {
  /** Carga vigente: solo su respuesta se aplica (la última petición gana). */
  requestId: number;
  status: LoadStatus;
  items: T[];
  /** Llegadas en vivo durante una carga: se reaplican sobre la respuesta del servidor. */
  pending: T[];
}

export type LiveCollectionAction<T> =
  | { type: 'load-start'; requestId: number }
  | { type: 'load-success'; requestId: number; items: T[] }
  | { type: 'load-failure'; requestId: number }
  | { type: 'received'; item: T };

export const INITIAL_LIVE_COLLECTION: LiveCollectionState<never> = {
  requestId: 0,
  status: 'loading',
  items: [],
  pending: [],
};

/**
 * Inserta o reemplaza por id quedándose con la versión más nueva: llegar dos veces no duplica y
 * un aviso atrasado nunca devuelve un elemento a un estado anterior.
 */
function upsert<T extends Versioned>(items: readonly T[], item: T): T[] {
  const current = items.find(({ id }) => id === item.id);
  if (current !== undefined && current.version >= item.version) {
    return [...items];
  }
  return [...items.filter(({ id }) => id !== item.id), item];
}

/** Colección del servidor que se mantiene al día con avisos en vivo (sin orden: lo da quien lee). */
export function liveCollectionReducer<T extends Versioned>(
  state: LiveCollectionState<T>,
  action: LiveCollectionAction<T>,
): LiveCollectionState<T> {
  switch (action.type) {
    case 'load-start':
      return { ...state, requestId: action.requestId, status: 'loading', pending: [] };
    case 'load-success':
      if (action.requestId !== state.requestId) {
        return state;
      }
      return {
        ...state,
        status: 'ready',
        items: state.pending.reduce<T[]>(upsert, [...action.items]),
        pending: [],
      };
    case 'load-failure':
      return action.requestId === state.requestId ? { ...state, status: 'error' } : state;
    case 'received':
      return {
        ...state,
        items: upsert(state.items, action.item),
        pending: state.status === 'loading' ? [...state.pending, action.item] : [],
      };
  }
}
