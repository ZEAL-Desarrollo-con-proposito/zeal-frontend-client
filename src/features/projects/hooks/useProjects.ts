import { useFetch } from '@/shared/hooks/useFetch';
import { useRealtimeStatus } from '@/shared/realtime/useRealtime';
import { fetchProject, fetchProjects } from '../api/projectsApi';

/**
 * Catálogo de convocatorias abiertas. Los cupos de cada una llegan en vivo por su canal; al
 * recuperarse la conexión se vuelve a pedir para no perder lo que cambió sin ella.
 */
export function useProjects() {
  const { recoveries } = useRealtimeStatus();
  const catalog = useFetch(`proyectos/${String(recoveries)}`, fetchProjects);
  return { status: catalog.status, projects: catalog.data ?? [], reload: catalog.reload };
}

/** Detalle de una convocatoria; también se vuelve a pedir al recuperarse la conexión. */
export function useProject(projectId: string) {
  const { recoveries } = useRealtimeStatus();
  return useFetch(`${projectId}/${String(recoveries)}`, (signal) =>
    fetchProject(projectId, signal),
  );
}
