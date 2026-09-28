import { RESERVATIONS_ENDPOINT } from '@/features/agenda/api/agendaApi';
import { InvalidResponseError } from '@/shared/api/errors';
import { request } from '@/shared/api/httpClient';
import type { Room } from '../model/room';
import { isRoom } from '../model/room';

/** Sala de la sesión de una reserva (sub-recurso de la reserva en el Wellbeing Service). */
export function roomEndpoint(reservationId: string): string {
  return `${RESERVATIONS_ENDPOINT}/${encodeURIComponent(reservationId)}/sala`;
}

function toRoom(payload: unknown): Room {
  if (!isRoom(payload)) {
    throw new InvalidResponseError('la sala');
  }
  return payload;
}

/** La sala, para cualquiera de sus dos participantes. */
export async function fetchRoom(reservationId: string, signal?: AbortSignal): Promise<Room> {
  return toRoom(await request(roomEndpoint(reservationId), { signal }));
}

/** El psicólogo activa la sala. Si aún no abre o ya cerró, el servidor lo rechaza (409). */
export async function activateRoom(reservationId: string): Promise<Room> {
  return toRoom(await request(`${roomEndpoint(reservationId)}/activar`, { method: 'POST' }));
}
