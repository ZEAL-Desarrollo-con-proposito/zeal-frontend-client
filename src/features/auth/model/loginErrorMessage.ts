import { ApiError, NetworkError } from '@/shared/api/errors';

export const LOGIN_ERROR_MESSAGES = {
  network: 'No pudimos conectar con ZEAL. Revisa tu conexión e intenta de nuevo.',
  serviceUnavailable: 'ZEAL no está disponible en este momento. Intenta de nuevo en unos minutos.',
  generic: 'No pudimos iniciar sesión con Microsoft. Intenta de nuevo.',
} as const;

/**
 * Lo que avisa el backend al volver de Microsoft (`/login?error=`). No dice qué cuentas existen:
 * solo que la cuenta con la que la persona entró no tiene acceso.
 */
export const LOGIN_RETURN_MESSAGES: ReadonlyMap<string, string> = new Map([
  [
    'cuenta_no_registrada',
    'Esa cuenta de Microsoft no tiene acceso a ZEAL. Ingresa con la cuenta de tu empresa o pide acceso a Talento Humano.',
  ],
  ['cancelado', 'Cancelaste el inicio de sesión con Microsoft. Puedes intentarlo de nuevo.'],
]);

/** Traduce un fallo al empezar el inicio de sesión a un mensaje para la persona usuaria. */
export function describeLoginError(error: unknown): string {
  if (error instanceof NetworkError) {
    return LOGIN_ERROR_MESSAGES.network;
  }
  if (error instanceof ApiError && error.status >= 500) {
    return LOGIN_ERROR_MESSAGES.serviceUnavailable;
  }
  return LOGIN_ERROR_MESSAGES.generic;
}

/**
 * Mensaje del error con el que se volvió de Microsoft; `null` si no hubo error. Un código
 * desconocido no se muestra tal cual: lo que llega en la URL no se pinta.
 */
export function describeReturnError(code: string | null): string | null {
  if (code === null) {
    return null;
  }
  return LOGIN_RETURN_MESSAGES.get(code) ?? LOGIN_ERROR_MESSAGES.generic;
}
