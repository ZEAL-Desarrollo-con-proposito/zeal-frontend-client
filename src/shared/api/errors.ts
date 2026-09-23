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

/** La petición no llegó al servidor (sin red, CORS, servidor caído). */
export class NetworkError extends Error {
  constructor(options?: ErrorOptions) {
    super('No fue posible conectar con el servidor', options);
    this.name = 'NetworkError';
  }
}
