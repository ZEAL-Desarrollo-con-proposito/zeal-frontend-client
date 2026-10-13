import { useFetch } from '@/shared/hooks/useFetch';
import { fetchWorkshopRoom } from '../api/workshopRoomApi';

/** La sala del taller; `reload` la vuelve a pedir cuando llega su hora de apertura o de cierre. */
export function useWorkshopRoom(workshopId: string) {
  return useFetch(workshopId, (signal) => fetchWorkshopRoom(workshopId, signal));
}
