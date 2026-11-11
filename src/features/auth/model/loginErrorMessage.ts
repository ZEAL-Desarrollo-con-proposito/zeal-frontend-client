import { ApiError, NetworkError } from '@/shared/api/errors';
import { isLoginLockout, LOGIN_LOCKOUT_MESSAGE } from './loginLockout';

export const LOGIN_ERROR_MESSAGES = {
  invalidCredentials: 'Correo o contraseña incorrectos.',
  network: 'No pudimos conectar con ZEAL. Revisa tu conexión e intenta de nuevo.',
  serviceUnavailable: 'ZEAL no está disponible en este momento. Intenta de nuevo en unos minutos.',
  generic: 'No pudimos iniciar sesión. Intenta de nuevo.',
} as const;

/** El servidor rechazó el correo o la contraseña (HTTP 401). */
export function isRejectedCredentials(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/** Traduce un fallo del inicio de sesión a un mensaje para la persona usuaria. */
export function describeLoginError(error: unknown): string {
  if (error instanceof NetworkError) {
    return LOGIN_ERROR_MESSAGES.network;
  }
  if (!(error instanceof ApiError)) {
    return LOGIN_ERROR_MESSAGES.generic;
  }
  if (isLoginLockout(error)) {
    return LOGIN_LOCKOUT_MESSAGE;
  }
  if (isRejectedCredentials(error)) {
    // HU-01: con credenciales inválidas se muestra el error de la respuesta 401.
    return error.serverMessage ?? LOGIN_ERROR_MESSAGES.invalidCredentials;
  }
  if (error.status >= 500) {
    return LOGIN_ERROR_MESSAGES.serviceUnavailable;
  }
  return error.serverMessage ?? LOGIN_ERROR_MESSAGES.generic;
}
