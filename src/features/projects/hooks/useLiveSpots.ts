import { useState } from 'react';
import { useRealtimeSubscription } from '@/shared/realtime/useRealtime';
import type { Spots } from '../model/project';
import { isSpotsEvent, latestSpots, projectTopic } from '../model/spotsEvent';

/**
 * Cupos de una convocatoria al día: escucha su canal y se queda con la versión más nueva entre
 * lo que se cargó del servidor y lo que llegó en vivo (los avisos atrasados no la pisan).
 */
export function useLiveSpots(projectId: string, loaded: Spots): Spots {
  const [live, setLive] = useState<Spots | null>(null);

  useRealtimeSubscription(projectTopic(projectId), (payload) => {
    if (isSpotsEvent(payload) && payload.projectId === projectId) {
      setLive((current) => latestSpots(payload, current));
    }
  });

  return latestSpots(loaded, live);
}
