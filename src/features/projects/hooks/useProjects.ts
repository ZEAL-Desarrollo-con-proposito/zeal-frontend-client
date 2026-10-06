import { useEffect, useReducer } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useFetch } from '@/shared/hooks/useFetch';
import { useRealtimeStatus, useRealtimeSubscription } from '@/shared/realtime/useRealtime';
import { fetchProject, fetchProjects } from '../api/projectsApi';
import type { Project, ProjectDetail } from '../model/project';
import { isProjectPublishedEvent, organizationProjectsTopic } from '../model/projectCatalogEvent';

interface CatalogState {
  knownIds: Set<string>;
  liveProjects: Project[];
}

type CatalogAction = { type: 'reset' } | { type: 'received'; project: Project };

function catalogReducer(state: CatalogState, action: CatalogAction): CatalogState {
  if (action.type === 'reset') {
    return { knownIds: new Set(), liveProjects: [] };
  }
  if (state.knownIds.has(action.project.id)) {
    return state;
  }
  const knownIds = new Set(state.knownIds);
  knownIds.add(action.project.id);
  return { knownIds, liveProjects: [...state.liveProjects, action.project] };
}

/** Del detalle largo al resumen del catálogo (sin description/requirements/skills). */
function toProjectSummary(detail: ProjectDetail): Project {
  const { id, title, area, cohort, summary, capacity, occupied, version, closesAt } = detail;
  return { id, title, area, cohort, summary, capacity, occupied, version, closesAt };
}

/** Más próxima a cerrar primero, como la lista del servidor. */
function byClosingSoonest(a: Project, b: Project): number {
  return Date.parse(a.closesAt) - Date.parse(b.closesAt);
}

/**
 * Catálogo de convocatorias abiertas del empleado. Se pide por HTTP al abrir y se mantiene al
 * día en tiempo real: cuando el admin publica una convocatoria, aparece aquí sin recargar
 * (HU-FE-16). Los cupos de cada una siguen por su propio canal (`useLiveSpots`).
 */
export function useProjects() {
  const { session } = useAuth();
  const organization = session?.user.organization ?? '';
  const { recoveries } = useRealtimeStatus();
  const catalog = useFetch(`proyectos/${String(recoveries)}`, fetchProjects);
  const [live, dispatch] = useReducer(catalogReducer, {
    knownIds: new Set<string>(),
    liveProjects: [],
  });

  useEffect(() => {
    dispatch({ type: 'reset' });
  }, [organization]);

  useRealtimeSubscription(organizationProjectsTopic(organization), (payload) => {
    if (isProjectPublishedEvent(payload)) {
      dispatch({ type: 'received', project: toProjectSummary(payload.project) });
    }
  });

  const loadedIds = new Set((catalog.data ?? []).map(({ id }) => id));
  const liveOnly = live.liveProjects.filter(({ id }) => !loadedIds.has(id));
  const merged = [...(catalog.data ?? []), ...liveOnly].sort(byClosingSoonest);

  return { status: catalog.status, projects: merged, reload: catalog.reload };
}

/** Detalle de una convocatoria; también se vuelve a pedir al recuperarse la conexión. */
export function useProject(projectId: string) {
  const { recoveries } = useRealtimeStatus();
  return useFetch(`${projectId}/${String(recoveries)}`, (signal) =>
    fetchProject(projectId, signal),
  );
}
