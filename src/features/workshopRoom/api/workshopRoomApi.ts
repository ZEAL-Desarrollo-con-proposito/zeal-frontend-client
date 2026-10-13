import { WORKSHOPS_ENDPOINT } from '@/features/workshops/api/workshopsApi';
import { InvalidResponseError } from '@/shared/api/errors';
import { request } from '@/shared/api/httpClient';
import type { WorkshopRoom } from '../model/workshopRoom';
import { isWorkshopRoom } from '../model/workshopRoom';

/** Sala de video de un taller (sub-recurso del taller en el Marketplace Service). */
export function workshopRoomEndpoint(workshopId: string): string {
  return `${WORKSHOPS_ENDPOINT}/${encodeURIComponent(workshopId)}/sala`;
}

/** La sala, para la empresa anfitriona o una persona inscrita; a nadie más (404). */
export async function fetchWorkshopRoom(
  workshopId: string,
  signal?: AbortSignal,
): Promise<WorkshopRoom> {
  const payload = await request(workshopRoomEndpoint(workshopId), { signal });
  if (!isWorkshopRoom(payload)) {
    throw new InvalidResponseError('la sala del taller');
  }
  return payload;
}
