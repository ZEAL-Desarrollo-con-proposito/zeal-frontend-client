import { useRef, useState } from 'react';
import { NOW_REFRESH_MS, useNow } from '@/shared/hooks/useNow';
import { login } from '../api/authApi';
import { describeLoginError, isRejectedCredentials } from '../model/loginErrorMessage';
import { toLoginLockout, type LoginLockout } from '../model/loginLockout';
import type { Credentials, Session } from '../model/session';

export type LoginField = keyof Credentials;
export type FieldErrors = Partial<Record<LoginField, string>>;

/**
 * Forma nombre@dominio.tld: una sola "@" con texto antes, un punto en el dominio que no esté en
 * los extremos y sin espacios. Sin expresiones regulares para evitar backtracking (ReDoS).
 */
export function isEmailFormat(value: string): boolean {
  const at = value.indexOf('@');
  const lastDot = value.lastIndexOf('.');
  return (
    !value.includes(' ') &&
    at > 0 &&
    at === value.lastIndexOf('@') &&
    lastDot > at + 1 &&
    lastDot < value.length - 1
  );
}

export function validateCredentials({ email, password }: Credentials): FieldErrors {
  const errors: FieldErrors = {};
  const trimmedEmail = email.trim();
  if (trimmedEmail === '') {
    errors.email = 'Ingresa tu correo corporativo';
  } else if (!isEmailFormat(trimmedEmail)) {
    errors.email = 'Ingresa un correo válido, por ejemplo nombre@empresa.com';
  }
  if (password === '') {
    errors.password = 'Ingresa tu contraseña';
  }
  return errors;
}

export type AuthenticatedHandler = (session: Session) => void;

/** Mientras el origen está bloqueado, la cuenta atrás se refresca cada segundo. */
const LOCKOUT_TICK_MS = 1000;

/** Fallo del envío. `attempt` distingue intentos fallidos seguidos con el mismo mensaje. */
export interface SubmitError {
  message: string;
  attempt: number;
}

/** Estado y reglas del formulario de inicio de sesión, separados de su presentación. */
export function useLoginForm(onAuthenticated: AuthenticatedHandler) {
  const [credentials, setCredentials] = useState<Credentials>({ email: '', password: '' });
  const [remember, setRemember] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const [lockout, setLockout] = useState<LoginLockout | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const failedAttempts = useRef(0);

  const tick = useNow(lockout === null ? NOW_REFRESH_MS : LOCKOUT_TICK_MS);
  // `tick` puede venir del refresco anterior (hasta 30 s): el inicio del bloqueo lo corrige.
  const now = lockout === null ? tick : Math.max(tick, lockout.startedAt);
  const remainingMs = lockout === null ? 0 : Math.max(0, lockout.until - now);
  const isLocked = remainingMs > 0;

  function updateField(field: LoginField, value: string) {
    setCredentials((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(null);
  }

  async function authenticate() {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const session = await login(
        { email: credentials.email.trim(), password: credentials.password },
        remember,
      );
      onAuthenticated(session);
    } catch (error) {
      const blocked = toLoginLockout(error);
      if (blocked !== null) {
        setLockout(blocked);
        setSubmitError(null);
        return;
      }
      failedAttempts.current += 1;
      setSubmitError({ message: describeLoginError(error), attempt: failedAttempts.current });
      if (isRejectedCredentials(error)) {
        setCredentials((current) => ({ ...current, password: '' }));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  /** Valida y, si todo es correcto, inicia la autenticación. Devuelve los errores de validación. */
  function submit(): FieldErrors {
    if (isLocked) {
      return {};
    }
    const errors = validateCredentials(credentials);
    setFieldErrors(errors);
    if (Object.keys(errors).length === 0) {
      void authenticate();
    }
    return errors;
  }

  return {
    credentials,
    remember,
    fieldErrors,
    submitError,
    lockout: lockout === null ? null : { until: lockout.until, remainingMs },
    isLocked,
    isSubmitting,
    updateField,
    setRemember,
    submit,
  };
}
