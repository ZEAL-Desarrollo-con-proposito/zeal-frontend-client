import { ApiError, NetworkError } from './errors';

export const MUTATION_ERROR_MESSAGES = {
  network: 'No pudimos conectar con ZEAL. Revisa tu conexión e intenta de nuevo.',
  generic: 'No pudimos guardar el cambio. Intenta de nuevo en unos minutos.',
} as const;

/**
 * Mensaje para un cambio rechazado. Las reglas de negocio viven en el backend: si el servidor
 * explica el rechazo (4xx), se muestra su mensaje tal cual; los fallos internos no se exponen.
 */
export function describeMutationError(error: unknown): string {
  if (error instanceof NetworkError) {
    return MUTATION_ERROR_MESSAGES.network;
  }
  if (error instanceof ApiError && error.status < 500 && error.serverMessage !== undefined) {
    return error.serverMessage;
  }
  return MUTATION_ERROR_MESSAGES.generic;
}
