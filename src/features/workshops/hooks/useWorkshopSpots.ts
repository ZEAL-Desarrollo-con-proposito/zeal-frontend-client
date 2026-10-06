import type { Spots } from '@/shared/spots/spots';
import { useLiveSpots } from '@/shared/spots/useLiveSpots';
import { isWorkshopSpotsEvent, workshopTopic } from '../model/workshopEvent';

/** Cupos de un taller al día, por su canal en el Real-Time Gateway. */
export function useWorkshopSpots(workshopId: string, loaded: Spots): Spots {
  return useLiveSpots(workshopTopic(workshopId), loaded, (payload) =>
    isWorkshopSpotsEvent(payload) && payload.workshopId === workshopId ? payload : null,
  );
}
