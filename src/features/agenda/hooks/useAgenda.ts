import { toIsoDate } from '@/shared/lib/dates';
import { fetchAgenda } from '../api/agendaApi';
import { useAgendaResource } from './useAgendaResource';

/** Agenda de la semana, al día con los cambios en tiempo real. */
export function useAgenda(from: Date, to: Date, psychologistId: string) {
  const agenda = useAgendaResource(
    `${toIsoDate(from)}/${toIsoDate(to)}`,
    psychologistId,
    (signal) => fetchAgenda({ from, to }, signal),
  );
  return { status: agenda.status, reservations: agenda.data ?? [], reload: agenda.reload };
}
