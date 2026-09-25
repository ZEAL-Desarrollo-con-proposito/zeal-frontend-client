import { isSlotEvent, SLOTS_TOPIC } from '@/features/availability/model/slotEvent';
import { useFetch } from '@/shared/hooks/useFetch';
import { toIsoDate } from '@/shared/lib/dates';
import { useRealtimeStatus, useRealtimeSubscription } from '@/shared/realtime/useRealtime';
import { fetchAgenda } from '../api/agendaApi';

/**
 * Agenda de la semana, al día: cuando una franja de este psicólogo cambia de estado en vivo
 * (un paciente reserva o cancela) o se recupera la conexión, se vuelve a pedir la agenda.
 */
export function useAgenda(from: Date, to: Date, psychologistId: string) {
  const { recoveries } = useRealtimeStatus();
  const key = `${toIsoDate(from)}/${toIsoDate(to)}/${String(recoveries)}`;
  const agenda = useFetch(key, (signal) => fetchAgenda({ from, to }, signal));

  useRealtimeSubscription(SLOTS_TOPIC, (payload) => {
    if (
      isSlotEvent(payload) &&
      payload.type === 'ACTUALIZADA' &&
      payload.slot.psychologistId === psychologistId
    ) {
      agenda.reload();
    }
  });

  return { status: agenda.status, reservations: agenda.data ?? [], reload: agenda.reload };
}
