import { isSlotEvent, SLOTS_TOPIC } from '@/features/availability/model/slotEvent';
import { useLiveFetch } from '@/shared/realtime/useLiveFetch';
import { fetchDirectory } from '../api/directoryApi';

/**
 * Directorio al día: cualquier franja que se abra, se reserve o se elimine cambia la
 * disponibilidad de alguien, así que el servidor la recalcula y se vuelve a pedir.
 */
export function useDirectory() {
  const directory = useLiveFetch({
    key: 'directorio',
    load: fetchDirectory,
    listing: true,
    topic: SLOTS_TOPIC,
    isRelevant: isSlotEvent,
  });
  return {
    status: directory.status,
    psychologists: directory.data ?? [],
    reload: directory.reload,
  };
}
