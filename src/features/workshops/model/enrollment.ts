import { isRecord } from '@/features/auth/model/session';
import { isIsoDateTime } from '@/shared/lib/dates';
import type { ToastInput } from '@/shared/ui/Toast/toast';
import { workshopWhen } from './workshop';

/** Inscripción de la persona a un taller (contrato con HU-BE-18). */
export interface Enrollment {
  id: string;
  workshopId: string;
  workshopTitle: string;
  facilitator: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  version: number;
}

/** Cola privada de la persona: sus inscripciones nuevas o que cambiaron, en cualquier pestaña. */
export const ENROLLMENTS_QUEUE = '/user/queue/inscripciones';

export interface EnrollmentEvent {
  type: 'INSCRIPCION';
  enrollment: Enrollment;
}

export function isEnrollment(value: unknown): value is Enrollment {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.workshopId === 'string' &&
    typeof value.workshopTitle === 'string' &&
    typeof value.facilitator === 'string' &&
    isIsoDateTime(value.startsAt) &&
    isIsoDateTime(value.endsAt) &&
    isIsoDateTime(value.createdAt) &&
    typeof value.version === 'number' &&
    Number.isInteger(value.version)
  );
}

export function isEnrollmentEvent(value: unknown): value is EnrollmentEvent {
  return isRecord(value) && value.type === 'INSCRIPCION' && isEnrollment(value.enrollment);
}

/** Aviso justo después de inscribirse: el cupo ya es de la persona. */
export function enrollmentToast(enrollment: Enrollment, now: number): ToastInput {
  return {
    tone: 'success',
    title: `¡Tienes tu cupo en ${enrollment.workshopTitle}!`,
    message: `${workshopWhen(enrollment.startsAt, now)} con ${enrollment.facilitator}. Lo encuentras en Mis talleres.`,
  };
}
