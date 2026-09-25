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
