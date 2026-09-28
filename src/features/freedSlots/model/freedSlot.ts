import { isRecord } from '@/features/auth/model/session';
import { formatTime } from '@/shared/lib/dates';

/** Cupo que otra persona liberó (contrato con el Wellbeing Service, HU-BE-08). */
export interface FreedSlotOffer {
  id: string;
  psychologist: { id: string; fullName: string; title: string };
  startsAt: string;
  endsAt: string;
  /** Hasta cuándo se puede tomar; lo fija el servidor, el cliente solo lo compara con el reloj. */
  expiresAt: string;
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export function isFreedSlotOffer(value: unknown): value is FreedSlotOffer {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isRecord(value.psychologist) &&
    typeof value.psychologist.id === 'string' &&
    typeof value.psychologist.fullName === 'string' &&
    typeof value.psychologist.title === 'string' &&
    isIsoDateTime(value.startsAt) &&
    isIsoDateTime(value.endsAt) &&
    isIsoDateTime(value.expiresAt)
  );
}

/** Milisegundos que le quedan al cupo; nunca negativo. */
export function remainingMs({ expiresAt }: Pick<FreedSlotOffer, 'expiresAt'>, now: number): number {
  return Math.max(0, Date.parse(expiresAt) - now);
}

/** "4:32": minutos y segundos que faltan (se redondea hacia arriba: 0:00 solo cuando venció). */
export function formatCountdown(remaining: number): string {
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  return `${String(minutes)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

/** "9:25": la hora límite, para quien no puede seguir un contador que cambia cada segundo. */
export function formatDeadline({ expiresAt }: Pick<FreedSlotOffer, 'expiresAt'>): string {
  return formatTime(new Date(expiresAt));
}
