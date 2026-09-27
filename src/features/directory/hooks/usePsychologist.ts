import { isSlotEvent, SLOTS_TOPIC } from '@/features/availability/model/slotEvent';
import { useLiveFetch } from '@/shared/realtime/useLiveFetch';
import { fetchPsychologist } from '../api/directoryApi';

/** Perfil de un psicólogo con su próximo bloque libre, al día con los cambios de sus franjas. */
export function usePsychologist(psychologistId: string) {
  return useLiveFetch({
    key: psychologistId,
    load: (signal) => fetchPsychologist(psychologistId, signal),
    topic: SLOTS_TOPIC,
    isRelevant: (payload) => isSlotEvent(payload) && payload.slot.psychologistId === psychologistId,
  });
}
