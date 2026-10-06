import { useEffect, useReducer, useRef, useState } from 'react';
import type { ApiError } from '@/shared/api/errors';
import { isForbidden } from '@/shared/api/errors';
import { useRealtimeStatus, useRealtimeSubscription } from '@/shared/realtime/useRealtime';
import { fetchAdminProjects } from '../api/adminProjectsApi';
import type { AdminProject } from '../model/adminProject';
import { compareByNewest } from '../model/adminProject';
import { isProjectPublishedEvent, PROJECTS_QUEUE } from '../model/adminProjectEvent';
import { adminProjectsReducer, INITIAL_ADMIN_PROJECTS_STATE } from '../model/adminProjectsState';

interface AdminProjectsOptions {
  /** Una convocatoria que aún no se conocía llegó en vivo */
  onRemotePublished?: (project: AdminProject) => void;
}

/**
 * Convocatorias publicadas de la organización, al día en tiempo real:
 * - suma las que otros administradores publican (cola privada)
 * - una publicada aquí se muestra al instante, sin esperar a su evento;
 * - al recuperarse la conexión vuelve a pedir la lista para no perder cambios.
 * Un 403 no se reintenta: se lanza para que la ruta muestre "Permiso denegado".
 */
export function useAdminProjects({ onRemotePublished }: AdminProjectsOptions = {}) {
  const [state, dispatch] = useReducer(adminProjectsReducer, INITIAL_ADMIN_PROJECTS_STATE);
  const [attempt, setAttempt] = useState(0);
  const [denied, setDenied] = useState<ApiError | null>(null);
  const { recoveries } = useRealtimeStatus();
  const requestCounter = useRef(0);
  /** Ids ya conocidos: el eco de lo publicado aquí no se anuncia como si fuera de otra sesión. */
  const knownIds = useRef(new Set<string>());

  useEffect(() => {
    requestCounter.current += 1;
    const requestId = requestCounter.current;
    const controller = new AbortController();
    dispatch({ type: 'load-start', requestId });
    fetchAdminProjects(controller.signal).then(
      (projects) => {
        projects.forEach(({ id }) => knownIds.current.add(id));
        dispatch({ type: 'load-success', requestId, projects });
      },
      (error: unknown) => {
        if (isForbidden(error)) {
          setDenied(error);
          return;
        }
        dispatch({ type: 'load-failure', requestId });
      },
    );
    return () => {
      controller.abort();
    };
  }, [attempt, recoveries]);

  useRealtimeSubscription(PROJECTS_QUEUE, (payload) => {
    if (!isProjectPublishedEvent(payload)) {
      return;
    }
    const isUnknown = !knownIds.current.has(payload.project.id);
    knownIds.current.add(payload.project.id);
    dispatch({ type: 'published', project: payload.project });
    if (isUnknown) {
      onRemotePublished?.(payload.project);
    }
  });

  if (denied !== null) {
    throw denied;
  }

  return {
    status: state.status,
    projects: [...state.projects].sort(compareByNewest),
    retry: () => {
      setAttempt((current) => current + 1);
    },
    /** Aplica una convocatoria confirmada por el servidor (idempotente). */
    addProject: (project: AdminProject) => {
      knownIds.current.add(project.id);
      dispatch({ type: 'published', project });
    },
  };
}
