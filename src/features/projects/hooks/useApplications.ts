import { describeMutationError } from '@/shared/api/describeError';
import { useSubmitting } from '@/shared/hooks/useSubmitting';
import { useLiveCollection } from '@/shared/realtime/useLiveCollection';
import { useToast } from '@/shared/ui/Toast/useToast';
import { applyToProject, fetchMyApplications } from '../api/projectsApi';
import type { Application } from '../model/application';
import {
  APPLICATIONS_QUEUE,
  applicationToast,
  byNewest,
  isApplicationEvent,
} from '../model/application';

function readApplication(payload: unknown): Application | null {
  return isApplicationEvent(payload) ? payload.application : null;
}

/**
 * Postulaciones de la persona (HU-FE-17), al día en tiempo real por su cola privada. Postularse
 * bloquea esa convocatoria mientras el servidor responde (sin envíos dobles) e informa el
 * resultado que decidió el servidor: aceptada o lista de espera.
 */
export function useApplications() {
  const collection = useLiveCollection({
    load: fetchMyApplications,
    queue: APPLICATIONS_QUEUE,
    read: readApplication,
    compare: byNewest,
  });
  const { isSubmitting, submit } = useSubmitting();
  const showToast = useToast();

  function apply(projectId: string) {
    return submit(projectId, async () => {
      try {
        const application = await applyToProject(projectId);
        collection.received(application);
        showToast(applicationToast(application));
      } catch (error) {
        showToast({
          tone: 'warning',
          title: 'No pudimos enviar tu postulación',
          message: describeMutationError(error),
        });
      }
    });
  }

  function applicationFor(projectId: string): Application | null {
    return collection.items.find((application) => application.projectId === projectId) ?? null;
  }

  return {
    status: collection.status,
    applications: collection.items,
    applicationFor,
    isSending: isSubmitting,
    apply,
    reload: collection.reload,
  };
}
