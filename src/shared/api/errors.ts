/** El servidor respondió con un código HTTP de error. */
export class ApiError extends Error {
  readonly status: number;
  /** Mensaje legible que envió el servidor en el cuerpo de la respuesta, si lo hubo. */
  readonly serverMessage: string | undefined;

  constructor(status: number, serverMessage?: string) {
    super(serverMessage ?? `La petición falló con estado HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

/** El servidor negó el acceso (403): quien pide no tiene permiso, y reintentar no cambia nada. */
export function isForbidden(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 403;
}

/** El servidor no encontró el recurso (404), o lo oculta porque no es de quien lo pide (SEG-2). */
export function isNotFound(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 404;
}

/**
 * Lo que se pidió es una pantalla que existe para quien tiene acceso: un 404 significa que el
 * servidor la oculta para no revelar nada (SEG-2). Reintentar no cambia nada.
 */
export function isAccessDenied(error: unknown): error is ApiError {
  return isForbidden(error) || isNotFound(error);
}

/** El servidor respondió con éxito pero con una forma distinta a la del contrato. */
export class InvalidResponseError extends Error {
  constructor(resource: string) {
    super(`La respuesta del servidor para ${resource} no tiene el formato esperado`);
    this.name = 'InvalidResponseError';
  }
}

/** La petición no llegó al servidor (sin red, CORS, servidor caído). */
export class NetworkError extends Error {
  constructor(options?: ErrorOptions) {
    super('No fue posible conectar con el servidor', options);
    this.name = 'NetworkError';
  }
}
