import type { LoadStatus } from '@/shared/hooks/useFetch';
import type { Application } from './application';
import { byNewest } from './application';

export interface ApplicationsState {
  /** Carga vigente: solo su respuesta se aplica (la última petición gana). */
  requestId: number;
  status: LoadStatus;
  applications: Application[];
  /** Llegadas en vivo durante una carga: se reaplican sobre la respuesta del servidor. */
  pending: Application[];
}

export type ApplicationsAction =
  | { type: 'load-start'; requestId: number }
  | { type: 'load-success'; requestId: number; applications: Application[] }
  | { type: 'load-failure'; requestId: number }
  | { type: 'received'; application: Application };

export const INITIAL_APPLICATIONS_STATE: ApplicationsState = {
  requestId: 0,
  status: 'loading',
  applications: [],
  pending: [],
};

/**
 * Inserta o reemplaza por id quedándose con la versión más nueva: llegar dos veces no duplica y
 * un aviso atrasado nunca devuelve una postulación a un estado anterior.
 */
function upsert(applications: readonly Application[], application: Application): Application[] {
  const current = applications.find(({ id }) => id === application.id);
  if (current !== undefined && current.version >= application.version) {
    return [...applications];
  }
  return [...applications.filter(({ id }) => id !== application.id), application].sort(byNewest);
}

export function applicationsReducer(
  state: ApplicationsState,
  action: ApplicationsAction,
): ApplicationsState {
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
        applications: state.pending.reduce(upsert, [...action.applications].sort(byNewest)),
        pending: [],
      };
    case 'load-failure':
      return action.requestId === state.requestId ? { ...state, status: 'error' } : state;
    case 'received':
      return {
        ...state,
        applications: upsert(state.applications, action.application),
        pending: state.status === 'loading' ? [...state.pending, action.application] : [],
      };
  }
}
