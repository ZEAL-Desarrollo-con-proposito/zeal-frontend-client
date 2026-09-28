import { useLiveFetch } from '@/shared/realtime/useLiveFetch';
import { fetchRoom } from '../api/roomApi';
import { isRoomEvent, ROOMS_QUEUE } from '../model/roomEvent';

/**
 * Sala al día en tiempo real: se vuelve a pedir cuando el servidor avisa que cambió (el
 * psicólogo la activó o se canceló la sesión) o cuando se recupera la conexión.
 */
export function useRoom(reservationId: string) {
  return useLiveFetch({
    key: reservationId,
    load: (signal) => fetchRoom(reservationId, signal),
    topic: ROOMS_QUEUE,
    isRelevant: (payload) =>
      isRoomEvent(payload) &&
      payload.type === 'SALA_ACTUALIZADA' &&
      payload.reservationId === reservationId,
  });
}
