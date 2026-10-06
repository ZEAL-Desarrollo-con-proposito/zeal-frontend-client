import { isRecord } from '@/features/auth/model/session';
import type { Spots } from '@/shared/spots/spots';
import { isSpots } from '@/shared/spots/spots';

/** Canal de cada convocatoria en el Real-Time Gateway: avisa cuando cambian sus cupos. */
export function projectTopic(projectId: string): string {
  return `/topic/proyectos/${encodeURIComponent(projectId)}/cupos`;
}

/** `CUPOS`: el servidor asignó, liberó o amplió cupos de una convocatoria. */
export interface SpotsEvent extends Spots {
  type: 'CUPOS';
  projectId: string;
}

export function isSpotsEvent(value: unknown): value is SpotsEvent {
  return (
    isRecord(value) &&
    value.type === 'CUPOS' &&
    typeof value.projectId === 'string' &&
    isSpots(value)
  );
}
