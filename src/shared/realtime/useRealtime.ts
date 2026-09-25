import { use, useEffect, useEffectEvent, useSyncExternalStore } from 'react';
import type { RealtimeListener, RealtimeStatus } from './realtimeClient';
import { RealtimeContext } from './RealtimeContext';

const noSubscription = () => () => undefined;

/** Estado de la conexión en tiempo real y cuántas veces se ha recuperado. */
export function useRealtimeStatus(): { status: RealtimeStatus; recoveries: number } {
  const client = use(RealtimeContext);
  const subscribe = client === null ? noSubscription : client.onChange;
  const status = useSyncExternalStore(subscribe, () =>
    client === null ? 'idle' : client.getStatus(),
  );
  const recoveries = useSyncExternalStore(subscribe, () =>
    client === null ? 0 : client.getRecoveries(),
  );
  return { status, recoveries };
}

/** Escucha un destino mientras el componente está montado (siempre con el callback más reciente). */
export function useRealtimeSubscription(destination: string, listener: RealtimeListener): void {
  const client = use(RealtimeContext);
  const onMessage = useEffectEvent(listener);

  useEffect(() => {
    if (client === null) {
      return undefined;
    }
    return client.subscribe(destination, (payload) => {
      onMessage(payload);
    });
  }, [client, destination]);
}
