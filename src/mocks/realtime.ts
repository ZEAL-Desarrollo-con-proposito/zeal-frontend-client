import { presenceTopic } from '@/features/presence/model/presenceEvent';
import type { RealtimeClient, RealtimeListener } from '@/shared/realtime/realtimeClient';
import { createStatusStore } from '@/shared/realtime/realtimeClient';
import { readMockTokenSubject } from './mockToken';
import { setPresence } from './presenceDb';

/**
 * Real-Time Gateway simulado. Los handlers de MSW publican en un BroadcastChannel y cada pestaña
 * abierta lo recibe como si viniera por STOMP: dos pestañas (p. ej. psicóloga y empleado) ven los
 * cambios de la otra al instante, igual que en la demo con el backend real.
 */
export const MOCK_REALTIME_CHANNEL = 'zeal-mock-realtime';

interface Envelope {
  destination: string;
  payload: unknown;
  /** Destinatario de un mensaje de usuario (`/user/...`); sin él, llega a todas las sesiones. */
  userId?: string;
}

/**
 * Como el servidor real (HU-BE-24): cada evento lleva la hora en que se emitió, con la que el
 * cliente mide cuánto tarda en pintarlo. Si ya la trae (una prueba que la fija), se respeta.
 */
function stamped(payload: unknown): unknown {
  return typeof payload === 'object' && payload !== null && !('emittedAt' in payload)
    ? { ...payload, emittedAt: new Date().toISOString() }
    : payload;
}

function post({ payload, ...envelope }: Envelope): void {
  const channel = new BroadcastChannel(MOCK_REALTIME_CHANNEL);
  channel.postMessage({ ...envelope, payload: stamped(payload) });
  channel.close();
}

/** Mensaje para todas las sesiones suscritas al destino (p. ej. `/topic/franjas`). */
export function publishMockEvent(destination: string, payload: unknown): void {
  post({ destination, payload });
}

/** Mensaje a la cola privada de una persona, como `convertAndSendToUser` en Spring. */
export function publishToUser(userId: string, destination: string, payload: unknown): void {
  post({ destination, payload, userId });
}

/**
 * Lo que hace el servidor con un mensaje que envía un cliente (como un `@MessageMapping` de
 * Spring): recibe quién lo envía, a qué destino y con qué contenido.
 */
export type MockMessageHandler = (userId: string, destination: string, payload: unknown) => void;

const ignoreMessage: MockMessageHandler = () => undefined;

/** Combina varios manejadores (cada uno solo actúa sobre los destinos que reconoce). */
export function combineMockMessageHandlers(
  ...handlers: readonly MockMessageHandler[]
): MockMessageHandler {
  return (userId, destination, payload) => {
    handlers.forEach((handler) => {
      handler(userId, destination, payload);
    });
  };
}

/**
 * Cliente simulado; con el token sabe a quién pertenece y recibe solo sus mensajes privados.
 * Lo que envía lo procesa `onMessage`, el servidor simulado.
 */
export function createMockRealtimeClient(
  accessToken?: string,
  onMessage: MockMessageHandler = ignoreMessage,
): RealtimeClient {
  const subject = accessToken === undefined ? null : readMockTokenSubject(accessToken);
  const store = createStatusStore();
  const subscriptions = new Map<number, { destination: string; listener: RealtimeListener }>();
  let channel: BroadcastChannel | null = null;
  let nextId = 0;

  /**
   * Como lo haría el Real-Time Gateway real (HU-BE-10): registra y avisa que esta persona se
   * conectó o se desconectó, para quien esté viendo su presencia en otra pestaña.
   */
  function announcePresence(status: 'online' | 'offline') {
    if (subject === null) {
      return;
    }
    setPresence(subject, status);
    post({ destination: presenceTopic(subject), payload: { type: 'PRESENCIA', status } });
  }

  // Si la pestaña se cierra sin pasar por disconnect() (p. ej. sin cerrar sesión primero), igual
  // se avisa que esta persona quedó desconectada — como un backend real detectaría que el socket se cayó.
  function handlePageHide() {
    announcePresence('offline');
  }

  return {
    connect() {
      channel = new BroadcastChannel(MOCK_REALTIME_CHANNEL);
      channel.onmessage = ({ data }: MessageEvent<Envelope>) => {
        if (data.userId !== undefined && data.userId !== subject) {
          return;
        }
        subscriptions.forEach(({ destination, listener }) => {
          if (destination === data.destination) {
            listener(data.payload);
          }
        });
      };
      store.set('connected');
      announcePresence('online');
      window.addEventListener('pagehide', handlePageHide);
    },
    disconnect() {
      window.removeEventListener('pagehide', handlePageHide);
      announcePresence('offline');
      channel?.close();
      channel = null;
      store.set('idle');
    },
    subscribe(destination, listener) {
      nextId += 1;
      const id = nextId;
      subscriptions.set(id, { destination, listener });
      return () => {
        subscriptions.delete(id);
      };
    },
    publish(destination, payload) {
      if (channel !== null && subject !== null) {
        // Como por la red: el servidor recibe una copia, nunca el objeto del cliente.
        onMessage(subject, destination, structuredClone(payload));
      }
    },
    getStatus: store.getStatus,
    getRecoveries: store.getRecoveries,
    onChange: store.onChange,
  };
}
