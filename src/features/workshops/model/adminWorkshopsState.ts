import type { LoadStatus } from '@/shared/hooks/useFetch';
import type { Workshop } from './workshop';

export interface AdminWorkshopsState {
  /** Carga vigente: solo sus resultados se aplican y la última petición gana. */
  requestId: number;
  status: LoadStatus;
  workshops: Workshop[];
  /** Publicados mientras la lista cargaba: la foto del servidor puede ser anterior a ellos. */
  pending: Workshop[];
}

export type AdminWorkshopsAction =
  | { type: 'load-start'; requestId: number }
  | { type: 'load-success'; requestId: number; workshops: Workshop[] }
  | { type: 'load-failure'; requestId: number }
  | { type: 'published'; workshop: Workshop };

export const INITIAL_ADMIN_WORKSHOPS_STATE: AdminWorkshopsState = {
  requestId: 0,
  status: 'loading',
  workshops: [],
  pending: [],
};

/** Agrega el taller si aún no se conoce: aplicarlo dos veces no duplica nada. */
function insertIfAbsent(workshops: Workshop[], workshop: Workshop): Workshop[] {
  return workshops.some(({ id }) => id === workshop.id) ? workshops : [...workshops, workshop];
}

export function adminWorkshopsReducer(
  state: AdminWorkshopsState,
  action: AdminWorkshopsAction,
): AdminWorkshopsState {
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
        pending: [],
        workshops: state.pending.reduce(insertIfAbsent, action.workshops),
      };
    case 'load-failure':
      return action.requestId === state.requestId ? { ...state, status: 'error' } : state;
    case 'published':
      return {
        ...state,
        workshops: insertIfAbsent(state.workshops, action.workshop),
        pending: state.status === 'loading' ? [...state.pending, action.workshop] : state.pending,
      };
  }
}
