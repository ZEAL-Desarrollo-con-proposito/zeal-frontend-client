import { isRecord } from '@/features/auth/model/session';
import type { BadgeTone } from '@/shared/ui/Badge/Badge';
import type { ToastInput } from '@/shared/ui/Toast/toast';

export const APPLICATION_STATUSES = ['ACEPTADA', 'EN_ESPERA'] as const;

/**
 * Resultado de la postulación, decidido por el servidor de forma atómica: con cupo, `ACEPTADA`;
 * si el último cupo lo tomó otra persona un instante antes, `EN_ESPERA`.
 */
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Postulación de la persona a una convocatoria (contrato con HU-BE-17). */
export interface Application {
  id: string;
  projectId: string;
  projectTitle: string;
  status: ApplicationStatus;
  /** Puesto en la lista de espera; `null` si quedó aceptada. */
  waitlistPosition: number | null;
  createdAt: string;
  /** Crece con cada cambio (p. ej. pasar de la lista de espera a aceptada). */
  version: number;
}

/** Cola privada de la persona: sus postulaciones nuevas o que cambiaron, en cualquier pestaña. */
export const APPLICATIONS_QUEUE = '/user/queue/postulaciones';

export interface ApplicationEvent {
  type: 'POSTULACION';
  application: Application;
}

function isPosition(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isInteger(value) && value > 0);
}

export function isApplication(value: unknown): value is Application {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.projectId === 'string' &&
    typeof value.projectTitle === 'string' &&
    APPLICATION_STATUSES.some((status) => status === value.status) &&
    isPosition(value.waitlistPosition) &&
    typeof value.createdAt === 'string' &&
    !Number.isNaN(Date.parse(value.createdAt)) &&
    typeof value.version === 'number' &&
    Number.isInteger(value.version)
  );
}

export function isApplicationEvent(value: unknown): value is ApplicationEvent {
  return isRecord(value) && value.type === 'POSTULACION' && isApplication(value.application);
}

/** "Aceptada" en salvia o "Lista de espera · puesto 2" en malva (manual de identidad). */
export function applicationBadge({ status, waitlistPosition }: Application): {
  label: string;
  tone: BadgeTone;
} {
  if (status === 'ACEPTADA') {
    return { label: 'Aceptada', tone: 'sage' };
  }
  const position = waitlistPosition === null ? '' : ` · puesto ${String(waitlistPosition)}`;
  return { label: `Lista de espera${position}`, tone: 'mauve' };
}

/** Aviso del resultado justo después de postularse. */
export function applicationToast(application: Application): ToastInput {
  if (application.status === 'ACEPTADA') {
    return {
      tone: 'success',
      title: `¡Tienes un cupo en ${application.projectTitle}!`,
      message: 'Talento Humano te contactará para los siguientes pasos.',
    };
  }
  const position =
    application.waitlistPosition === null
      ? ''
      : ` Ocupas el puesto ${String(application.waitlistPosition)}.`;
  return {
    tone: 'info',
    title: `Quedaste en la lista de espera de ${application.projectTitle}`,
    message: `Otra persona tomó el último cupo un instante antes.${position} Si se libera uno, te avisamos.`,
  };
}

/** Más recientes primero. */
export function byNewest(a: Application, b: Application): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}
