import { useEffect, useReducer, useRef, useState } from 'react';
import { describeMutationError } from '@/shared/api/describeError';
import { useRealtimeStatus, useRealtimeSubscription } from '@/shared/realtime/useRealtime';
import { useToast } from '@/shared/ui/Toast/useToast';
import { applyToProject, fetchMyApplications } from '../api/projectsApi';
import type { Application } from '../model/application';
import { APPLICATIONS_QUEUE, applicationToast, isApplicationEvent } from '../model/application';
import { applicationsReducer, INITIAL_APPLICATIONS_STATE } from '../model/applicationsState';

/**
 * Postulaciones de la persona (HU-FE-17), al día en tiempo real:
 * - se cargan al entrar y se vuelven a pedir al recuperarse la conexión;
 * - las que se crean o cambian en otra pestaña o equipo llegan por su cola privada;
 * - postularse bloquea esa convocatoria mientras el servidor responde (sin envíos dobles) e
 *   informa el resultado que decidió el servidor: aceptada o lista de espera.
 */
export function useApplications() {
  const [state, dispatch] = useReducer(applicationsReducer, INITIAL_APPLICATIONS_STATE);
  const [attempt, setAttempt] = useState(0);
  const [sendingIds, setSendingIds] = useState<ReadonlySet<string>>(new Set());
  /** Envíos en curso, al instante: dos clics antes de volver a pintar no envían dos veces. */
  const sending = useRef(new Set<string>());
  const requestCounter = useRef(0);
  const showToast = useToast();
  const { recoveries } = useRealtimeStatus();

  useEffect(() => {
    requestCounter.current += 1;
    const requestId = requestCounter.current;
    const controller = new AbortController();
    dispatch({ type: 'load-start', requestId });
    fetchMyApplications(controller.signal).then(
      (applications) => {
        dispatch({ type: 'load-success', requestId, applications });
      },
      () => {
        dispatch({ type: 'load-failure', requestId });
      },
    );
    return () => {
      controller.abort();
    };
  }, [attempt, recoveries]);

  useRealtimeSubscription(APPLICATIONS_QUEUE, (payload) => {
    if (isApplicationEvent(payload)) {
      dispatch({ type: 'received', application: payload.application });
    }
  });

  function markSending(projectId: string, active: boolean) {
    if (active) {
      sending.current.add(projectId);
    } else {
      sending.current.delete(projectId);
    }
    setSendingIds(new Set(sending.current));
  }

  async function apply(projectId: string) {
    if (sending.current.has(projectId)) {
      return;
    }
    markSending(projectId, true);
    try {
      const application = await applyToProject(projectId);
      dispatch({ type: 'received', application });
      showToast(applicationToast(application));
    } catch (error) {
      showToast({
        tone: 'warning',
        title: 'No pudimos enviar tu postulación',
        message: describeMutationError(error),
      });
    } finally {
      markSending(projectId, false);
    }
  }

  function applicationFor(projectId: string): Application | null {
    return state.applications.find((application) => application.projectId === projectId) ?? null;
  }

  return {
    status: state.status,
    applications: state.applications,
    applicationFor,
    isSending: (projectId: string) => sendingIds.has(projectId),
    apply,
    reload: () => {
      setAttempt((current) => current + 1);
    },
  };
}
