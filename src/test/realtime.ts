import type { RealtimeClient } from '@/shared/realtime/realtimeClient';
import { createStatusStore } from '@/shared/realtime/realtimeClient';

/**
 * Cliente de tiempo real que la prueba controla con `store.set(...)`: decide cuándo se cae y
 * cuándo se recupera. No entrega mensajes, como una conexión caída.
 */
export function controlledRealtimeClient() {
  const store = createStatusStore();
  const client: RealtimeClient = {
    connect: () => {
      store.set('connected');
    },
    disconnect: () => {
      store.set('idle');
    },
    subscribe: () => () => undefined,
    publish: () => undefined,
    getStatus: store.getStatus,
    getRecoveries: store.getRecoveries,
    onChange: store.onChange,
  };
  return { client, store };
}
