import { useState } from 'react';
import { useRealtimeSubscription } from '@/shared/realtime/useRealtime';
import type { Spots } from './spots';
import { latestSpots } from './spots';

/**
 * Cupos al día: escucha el canal `topic` y se queda con la versión más nueva entre lo que se
 * cargó del servidor y lo que llegó en vivo (los avisos atrasados no la pisan). `read` extrae los
 * cupos de un aviso del canal, o `null` si el aviso no corresponde.
 */
export function useLiveSpots(
  topic: string,
  loaded: Spots,
  read: (payload: unknown) => Spots | null,
): Spots {
  const [live, setLive] = useState<Spots | null>(null);

  useRealtimeSubscription(topic, (payload) => {
    const spots = read(payload);
    if (spots !== null) {
      setLive((current) => latestSpots(spots, current));
    }
  });

  return latestSpots(loaded, live);
}
