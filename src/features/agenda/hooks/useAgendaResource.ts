import { isSlotEvent, SLOTS_TOPIC } from '@/features/availability/model/slotEvent';
import { useFetch } from '@/shared/hooks/useFetch';
import { useRealtimeStatus, useRealtimeSubscription } from '@/shared/realtime/useRealtime';

/**
 * Datos de la agenda que se mantienen al día: se vuelven a pedir cuando una franja de este
 * psicólogo cambia de estado en vivo (un paciente reserva o cancela) o se recupera la conexión.
 */
export function useAgendaResource<T>(
  key: string,
  psychologistId: string,
  load: (signal: AbortSignal) => Promise<T>,
) {
  const { recoveries } = useRealtimeStatus();
  const resource = useFetch(`${key}/${String(recoveries)}`, load);

  useRealtimeSubscription(SLOTS_TOPIC, (payload) => {
    if (
      isSlotEvent(payload) &&
      payload.type === 'ACTUALIZADA' &&
      payload.slot.psychologistId === psychologistId
    ) {
      resource.reload();
    }
  });

  return resource;
}
