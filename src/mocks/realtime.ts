import type { RealtimeClient, RealtimeListener } from '@/shared/realtime/realtimeClient';
import { createStatusStore } from '@/shared/realtime/realtimeClient';

/**
 * Real-Time Gateway simulado. Los handlers de MSW publican en un BroadcastChannel y cada pestaña
 * abierta lo recibe como si viniera por STOMP: dos pestañas (p. ej. psicóloga y empleado) ven los
 * cambios de la otra al instante, igual que en la demo con el backend real.
 */
export const MOCK_REALTIME_CHANNEL = 'zeal-mock-realtime';

interface Envelope {
  destination: string;
  payload: unknown;
}

export function publishMockEvent(destination: string, payload: unknown): void {
  const channel = new BroadcastChannel(MOCK_REALTIME_CHANNEL);
  channel.postMessage({ destination, payload } satisfies Envelope);
  channel.close();
}

export function createMockRealtimeClient(): RealtimeClient {
  const store = createStatusStore();
  const subscriptions = new Map<number, { destination: string; listener: RealtimeListener }>();
  let channel: BroadcastChannel | null = null;
  let nextId = 0;

  return {
    connect() {
      channel = new BroadcastChannel(MOCK_REALTIME_CHANNEL);
      channel.onmessage = ({ data }: MessageEvent<Envelope>) => {
        subscriptions.forEach(({ destination, listener }) => {
          if (destination === data.destination) {
            listener(data.payload);
          }
        });
      };
      store.set('connected');
    },
    disconnect() {
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
    getStatus: store.getStatus,
    getRecoveries: store.getRecoveries,
    onChange: store.onChange,
  };
}
