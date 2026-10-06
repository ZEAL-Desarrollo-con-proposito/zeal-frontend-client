import type { LoadStatus } from '@/shared/hooks/useFetch';
import type { AdminProject } from './adminProject';

export interface AdminProjectsState {
  /** Carga vigente: solo sus resultados se aplican y la ultima peticion gana. */
  requestId: number;
  status: LoadStatus;
  projects: AdminProject[];
  pending: AdminProject[];
}

export type AdminProjectsAction =
  | { type: 'load-start'; requestId: number }
  | { type: 'load-success'; requestId: number; projects: AdminProject[] }
  | { type: 'load-failure'; requestId: number }
  | { type: 'published'; project: AdminProject };

export const INITIAL_ADMIN_PROJECTS_STATE: AdminProjectsState = {
  requestId: 0,
  status: 'loading',
  projects: [],
  pending: [],
};

/** Agrega la convocatoria si aún no se conoce: aplicarla dos veces no duplica nada. */
function insertIfAbsent(projects: AdminProject[], project: AdminProject): AdminProject[] {
  return projects.some(({ id }) => id === project.id) ? projects : [...projects, project];
}

export function adminProjectsReducer(
  state: AdminProjectsState,
  action: AdminProjectsAction,
): AdminProjectsState {
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
        projects: state.pending.reduce(insertIfAbsent, action.projects),
      };
    case 'load-failure':
      return action.requestId === state.requestId ? { ...state, status: 'error' } : state;
    case 'published':
      return {
        ...state,
        projects: insertIfAbsent(state.projects, action.project),
        // Durante la carga la foto del servidor puede ser anterior a esta publicación.
        pending: state.status === 'loading' ? [...state.pending, action.project] : state.pending,
      };
  }
}
