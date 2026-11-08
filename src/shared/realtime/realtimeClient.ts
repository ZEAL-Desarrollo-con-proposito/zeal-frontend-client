/**
 * Puerto de tiempo real: la aplicación depende de esta interfaz, no de STOMP ni de SockJS.
 * Hay un adaptador para el Real-Time Gateway (STOMP sobre SockJS) y otro simulado para la demo.
 */

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting';

export type RealtimeListener = (payload: unknown) => void;

export interface RealtimeClient {
  connect: () => void;
  disconnect: () => void;
  /** Se suscribe a un destino; devuelve la función para cancelar la suscripción. */
  subscribe: (destination: string, listener: RealtimeListener) => () => void;
  /**
   * Envía un mensaje al servidor (STOMP SEND, p. ej. `/app/...`). Sin conexión se descarta:
   * quien envía debe poder repetirlo al reconectarse.
   */
  publish: (destination: string, payload: unknown) => void;
  getStatus: () => RealtimeStatus;
  /** Veces que la conexión se recuperó después de caerse (para pedir de nuevo lo perdido). */
  getRecoveries: () => number;
  onChange: (listener: () => void) => () => void;
}

/** Lo que la conexión necesita de la sesión, que puede renovar el token mientras sigue abierta. */
export interface RealtimeCredentials {
  /** Token vigente: cada reconexión usa el último. */
  currentToken: () => string | null;
  /** El servidor rechazó la conexión: quizá la sesión fue revocada (escenario SEG-4). */
  onRejected: () => void;
}

export type RealtimeClientFactory = (
  accessToken: string,
  credentials?: RealtimeCredentials,
) => RealtimeClient;

/** Estado de conexión observable, compartido por los adaptadores. */
export function createStatusStore() {
  let status: RealtimeStatus = 'idle';
  let recoveries = 0;
  let hasConnected = false;
  const listeners = new Set<() => void>();

  return {
    getStatus: () => status,
    getRecoveries: () => recoveries,
    set: (next: RealtimeStatus) => {
      if (next === 'connected') {
        recoveries += hasConnected ? 1 : 0;
        hasConnected = true;
      }
      status = next;
      listeners.forEach((listener) => {
        listener();
      });
    },
    onChange: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
