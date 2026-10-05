import { useState } from 'react';
import { useFetch } from '@/shared/hooks/useFetch';
import { useRealtimeStatus, useRealtimeSubscription } from '@/shared/realtime/useRealtime';
import { fetchPresence } from '../api/presenceApi';
import type { PresenceState } from '../model/presence';
import { isPresenceEvent, presenceTopic } from '../model/presenceEvent';

/** El estado en vivo solo vale para la persona y la conexión con la que se recibió. */
interface LivePresence {
  key: string;
  status: PresenceState;
}

/**
 * Presencia de otra persona (HU-FE-10): se consulta al abrir y cambia en menos de 1 s, porque el
 * aviso del tiempo real trae el estado nuevo directo, sin esperar a volver a pedirlo. Al reconectar
 * se vuelve a consultar para no quedar desactualizado.
 */
export function usePresence(userId: string): PresenceState | null {
  const { recoveries } = useRealtimeStatus();
  /** Cambia al cambiar de persona y al recuperarse la conexión: invalida lo recibido en vivo. */
  const key = `${userId}/${String(recoveries)}`;
  const snapshot = useFetch(key, (signal) => fetchPresence(userId, signal));
  const [live, setLive] = useState<LivePresence | null>(null);

  useRealtimeSubscription(presenceTopic(userId), (payload) => {
    if (isPresenceEvent(payload)) {
      setLive({ key, status: payload.status });
    }
  });

  return live !== null && live.key === key ? live.status : snapshot.data;
}
