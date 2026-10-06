import { useSubmitting } from '@/shared/hooks/useSubmitting';
import { useLiveCollection } from '@/shared/realtime/useLiveCollection';
import { useToast } from '@/shared/ui/Toast/useToast';
import { enrollInWorkshop, fetchMyEnrollments } from '../api/workshopsApi';
import type { Enrollment } from '../model/enrollment';
import { ENROLLMENTS_QUEUE, enrollmentToast, isEnrollmentEvent } from '../model/enrollment';
import { bySoonest } from '../model/workshop';

function readEnrollment(payload: unknown): Enrollment | null {
  return isEnrollmentEvent(payload) ? payload.enrollment : null;
}

/**
 * Inscripciones de la persona (HU-FE-18), al día en tiempo real por su cola privada. Inscribirse
 * no envía dos veces el mismo taller mientras el servidor responde; si el servidor la rechaza
 * (p. ej. sin cupos), la promesa falla con su motivo para mostrarlo donde se pidió.
 */
export function useEnrollments() {
  const collection = useLiveCollection({
    load: fetchMyEnrollments,
    queue: ENROLLMENTS_QUEUE,
    read: readEnrollment,
    compare: bySoonest,
  });
  const { isSubmitting, submit } = useSubmitting<Enrollment>();
  const showToast = useToast();

  function enroll(workshopId: string): Promise<Enrollment> {
    return submit(workshopId, async () => {
      const enrollment = await enrollInWorkshop(workshopId);
      collection.received(enrollment);
      showToast(enrollmentToast(enrollment, Date.now()));
      return enrollment;
    });
  }

  function enrollmentFor(workshopId: string): Enrollment | null {
    return collection.items.find((enrollment) => enrollment.workshopId === workshopId) ?? null;
  }

  return {
    status: collection.status,
    enrollments: collection.items,
    enrollmentFor,
    isEnrolling: isSubmitting,
    enroll,
    reload: collection.reload,
  };
}
