import { useFetch } from '@/shared/hooks/useFetch';
import { useRealtimeStatus } from '@/shared/realtime/useRealtime';
import { fetchWorkshops } from '../api/workshopsApi';

/**
 * Talleres comunitarios próximos (HU-FE-18), del más cercano al más lejano. Los cupos de cada uno
 * siguen por su propio canal (`useWorkshopSpots`); al recuperar la conexión se vuelven a pedir
 * para no perder lo que cambió mientras tanto.
 */
export function useWorkshops() {
  const { recoveries } = useRealtimeStatus();
  return useFetch(`talleres/${String(recoveries)}`, fetchWorkshops);
}
