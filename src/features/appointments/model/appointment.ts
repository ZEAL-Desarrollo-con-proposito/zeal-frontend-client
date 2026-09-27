import { isRecord } from '@/features/auth/model/session';

export const APPOINTMENT_STATUSES = ['CONFIRMADA', 'CANCELADA', 'FINALIZADA'] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Cita de un empleado con un psicólogo (contrato con el Wellbeing Service, HU-BE-05). */
export interface Appointment {
  id: string;
  psychologist: { id: string; fullName: string; title: string };
  startsAt: string;
  endsAt: string;
  /** Lo decide el servidor: una cita que ya terminó llega como FINALIZADA. */
  status: AppointmentStatus;
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export function isAppointment(value: unknown): value is Appointment {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isRecord(value.psychologist) &&
    typeof value.psychologist.id === 'string' &&
    typeof value.psychologist.fullName === 'string' &&
    typeof value.psychologist.title === 'string' &&
    isIsoDateTime(value.startsAt) &&
    isIsoDateTime(value.endsAt) &&
    APPOINTMENT_STATUSES.some((status) => status === value.status)
  );
}
