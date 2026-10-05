import { isRecord } from '@/features/auth/model/session';
import type { Spots } from './project';
import { isSpots } from './project';

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

/**
 * Los cupos más recientes entre lo que se cargó y lo que llegó en vivo: gana la versión mayor,
 * así un aviso atrasado nunca pisa una respuesta más nueva (ni al revés).
 */
export function latestSpots(loaded: Spots, live: Spots | null): Spots {
  const newest = live !== null && live.version > loaded.version ? live : loaded;
  return { capacity: newest.capacity, occupied: newest.occupied, version: newest.version };
}
