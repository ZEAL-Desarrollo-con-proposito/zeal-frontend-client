import type { Spots } from '@/shared/spots/spots';
import { useLiveSpots } from '@/shared/spots/useLiveSpots';
import { isSpotsEvent, projectTopic } from '../model/spotsEvent';

/** Cupos de una convocatoria al día, por su canal en el Real-Time Gateway. */
export function useProjectSpots(projectId: string, loaded: Spots): Spots {
  return useLiveSpots(projectTopic(projectId), loaded, (payload) =>
    isSpotsEvent(payload) && payload.projectId === projectId ? payload : null,
  );
}
