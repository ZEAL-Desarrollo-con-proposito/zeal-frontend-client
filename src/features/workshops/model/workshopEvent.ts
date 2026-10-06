import { isRecord } from '@/features/auth/model/session';
import type { Spots } from '@/shared/spots/spots';
import { isSpots } from '@/shared/spots/spots';
import type { Workshop } from './workshop';
import { isWorkshop } from './workshop';

/**
 * Cola privada de cada administrador en el Real-Time: el servidor solo entrega aquí los talleres
 * de su organización (los que publica otro administrador de la empresa).
 */
export const WORKSHOPS_QUEUE = '/user/queue/talleres';

/**
 * Canal público de la organización: avisa a todos sus empleados conectados cuando se publica un
 * taller nuevo, sin tener que recargar nada.
 */
export function organizationWorkshopsTopic(organization: string): string {
  return `/topic/organizaciones/${encodeURIComponent(organization)}/talleres`;
}

/** `PUBLICADO`: se publicó un taller nuevo, desde esta sesión o desde otra de la empresa. */
export interface WorkshopPublishedEvent {
  type: 'PUBLICADO';
  workshop: Workshop;
}

export function isWorkshopPublishedEvent(value: unknown): value is WorkshopPublishedEvent {
  return isRecord(value) && value.type === 'PUBLICADO' && isWorkshop(value.workshop);
}

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
