import { isSlotEvent, SLOTS_TOPIC } from '@/features/availability/model/slotEvent';
import { useLiveFetch } from '@/shared/realtime/useLiveFetch';

/**
 * Datos de la agenda que se mantienen al día: se vuelven a pedir cuando una franja de este
 * psicólogo cambia de estado en vivo (un paciente reserva o cancela) o se recupera la conexión.
 */
export function useAgendaResource<T>(
  key: string,
  psychologistId: string,
  load: (signal: AbortSignal) => Promise<T>,
) {
  return useLiveFetch({
    key,
    load,
    topic: SLOTS_TOPIC,
    isRelevant: (payload) =>
      isSlotEvent(payload) &&
      payload.type === 'ACTUALIZADA' &&
      payload.slot.psychologistId === psychologistId,
  });
}
