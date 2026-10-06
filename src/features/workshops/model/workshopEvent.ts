import { isRecord } from '@/features/auth/model/session';
import type { Spots } from '@/shared/spots/spots';
import { isSpots } from '@/shared/spots/spots';

/** Canal de cada taller en el Real-Time Gateway: avisa cuando cambian sus cupos. */
export function workshopTopic(workshopId: string): string {
  return `/topic/talleres/${encodeURIComponent(workshopId)}/cupos`;
}

/** `CUPOS`: el servidor inscribió a alguien, liberó o amplió cupos de un taller. */
export interface WorkshopSpotsEvent extends Spots {
  type: 'CUPOS';
  workshopId: string;
}

export function isWorkshopSpotsEvent(value: unknown): value is WorkshopSpotsEvent {
  return (
    isRecord(value) &&
    value.type === 'CUPOS' &&
    typeof value.workshopId === 'string' &&
    isSpots(value)
  );
}
