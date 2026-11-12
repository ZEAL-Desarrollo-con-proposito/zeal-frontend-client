import { ApiError } from '@/shared/api/errors';
import { formatLongDate, formatTime, isSameDay } from '@/shared/lib/dates';

/** Espera conservadora si el borde responde 429 o 403 sin un `Retry-After` utilizable. */
export const DEFAULT_LOGIN_LOCKOUT_SECONDS = 60;

/** `Retry-After: 0` significa reintentar ya; se deja un segundo para evitar un bucle inmediato. */
const MIN_LOGIN_LOCKOUT_SECONDS = 1;

export const LOGIN_LOCKOUT_MESSAGE =
  'El acceso desde esta red está bloqueado temporalmente por demasiados intentos.';

export interface LoginLockout {
  startedAt: number;
  until: number;
}

/**
 * Traduce el rechazo del inicio de sesión por fuerza bruta (SEG-1, ADR-15) a una espera local: el
 * 429 de NGINX y el 403 del bouncer de CrowdSec, con o sin `Retry-After`. Solo aplica a pedir la
 * dirección de Microsoft (desde HU-BE-21 el backend ya no responde 403 por permisos). No usa el
 * mensaje del servidor para no revelar si la cuenta existe.
 */
export function toLoginLockout(error: unknown, now: number = Date.now()): LoginLockout | null {
  if (!(error instanceof ApiError)) {
    return null;
  }
  const isRateLimited = error.status === 429;
  const isBouncerBlock = error.status === 403;
  if (!isRateLimited && !isBouncerBlock) {
    return null;
  }
  const seconds =
    error.retryAfterSeconds === null
      ? DEFAULT_LOGIN_LOCKOUT_SECONDS
      : Math.max(MIN_LOGIN_LOCKOUT_SECONDS, error.retryAfterSeconds);
  return { startedAt: now, until: now + seconds * 1000 };
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;

/**
 * "0:59", "1 h 05 min" o "1 d 2 h": espera restante. Los segundos se redondean hacia arriba para
 * no reactivar el envío antes de tiempo.
 */
export function formatLoginLockoutCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  if (totalSeconds >= SECONDS_PER_DAY) {
    const days = Math.floor(totalSeconds / SECONDS_PER_DAY);
    const hours = Math.floor((totalSeconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
    return hours === 0 ? `${days} d` : `${days} d ${hours} h`;
  }
  if (totalSeconds >= SECONDS_PER_HOUR) {
    const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
    const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
    return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
  }
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Momento en que termina el bloqueo, con fecha completa cuando cae en otro día. */
export function formatLoginLockoutDeadline(until: number, now: number = Date.now()): string {
  const deadline = new Date(until);
  const current = new Date(now);
  if (isSameDay(deadline, current)) {
    return `hoy a las ${formatTime(deadline)}`;
  }
  const date =
    deadline.getFullYear() === current.getFullYear()
      ? formatLongDate(deadline)
      : `${formatLongDate(deadline)} de ${deadline.getFullYear()}`;
  return `el ${date} a las ${formatTime(deadline)}`;
}
