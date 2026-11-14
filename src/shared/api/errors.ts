/** El servidor respondió con un código HTTP de error. */
export class ApiError extends Error {
  readonly status: number;
  /** Mensaje legible que envió el servidor en el cuerpo de la respuesta, si lo hubo. */
  readonly serverMessage: string | undefined;
  /** Segundos que pide esperar el servidor en `Retry-After`; `null` si no vino la cabecera. */
  readonly retryAfterSeconds: number | null;
  /** Identificador de la petición que falló, para cruzarla con los logs del backend. */
  readonly requestId: string | undefined;

  constructor(
    status: number,
    serverMessage?: string,
    retryAfterSeconds: number | null = null,
    requestId?: string,
  ) {
    super(serverMessage ?? `La petición falló con estado HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.serverMessage = serverMessage;
    this.retryAfterSeconds = retryAfterSeconds;
    this.requestId = requestId;
  }
}

/** El servidor negó el acceso (403): quien pide no tiene permiso, y reintentar no cambia nada. */
export function isForbidden(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 403;
}

/** El servidor no encontró el recurso (404), o lo oculta porque no es de quien lo pide (SEG-3). */
export function isNotFound(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 404;
}

/**
 * Lo que se pidió es una pantalla que existe para quien tiene acceso: un 404 significa que el
 * servidor la oculta para no revelar nada (SEG-3). Reintentar no cambia nada.
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

interface NetworkErrorOptions extends ErrorOptions {
  requestId?: string;
}

/** La petición no llegó al servidor (sin red, CORS, servidor caído). */
export class NetworkError extends Error {
  /** Identificador de la petición que no llegó, para cruzarla con los logs del backend. */
  readonly requestId: string | undefined;

  constructor(options: NetworkErrorOptions = {}) {
    super('No fue posible conectar con el servidor', options);
    this.name = 'NetworkError';
    this.requestId = options.requestId;
  }
}
