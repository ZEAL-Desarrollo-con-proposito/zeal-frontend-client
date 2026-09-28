import { useReducer, useRef } from 'react';
import { describeMutationError } from '@/shared/api/describeError';
import { ApiError } from '@/shared/api/errors';
import { useRealtimeSubscription } from '@/shared/realtime/useRealtime';
import { claimFreedSlot } from '../api/freedSlotsApi';
import { remainingMs } from '../model/freedSlot';
import { FREED_SLOTS_QUEUE, isFreedSlotEvent } from '../model/freedSlotEvent';
import { freedSlotsReducer, INITIAL_FREED_SLOTS_STATE } from '../model/freedSlotsState';

/** Cupos liberados que le llegan a la persona por su cola  pribada*/
export function useFreedSlots() {
  const [offers, dispatch] = useReducer(freedSlotsReducer, INITIAL_FREED_SLOTS_STATE);
  /** Cupos ya anunciados: si un evento llega dos veces no reaparece */
  const announced = useRef(new Set<string>());
  /** Cupos con un intento en curso o ya resuelto: bloquea el segundo clic de inmediato */
  const attempted = useRef(new Set<string>());

  useRealtimeSubscription(FREED_SLOTS_QUEUE, (payload) => {
    if (!isFreedSlotEvent(payload)) {
      return;
    }
    if (payload.type === 'TOMADO') {
      dispatch({ type: 'taken', id: payload.offerId });
      return;
    }
    const { offer } = payload;
    // Un cupo que ya venció al llegar enotnces no lo mostraremos
    if (announced.current.has(offer.id) || remainingMs(offer, Date.now()) === 0) {
      return;
    }
    announced.current.add(offer.id);
    dispatch({ type: 'offered', offer });
  });

  async function claim(id: string) {
    if (attempted.current.has(id)) {
      return;
    }
    attempted.current.add(id);
    dispatch({ type: 'claim-start', id });
    try {
      await claimFreedSlot(id);
      dispatch({ type: 'claim-won', id });
    } catch (reason) {
      if (reason instanceof ApiError && reason.status < 500) {
        const detail = reason.serverMessage;
        dispatch(
          reason.status === 409
            ? { type: 'claim-lost', id, detail }
            : { type: 'claim-gone', id, detail },
        );
        return;
      }
      // Sin conexión o error interno: el intento no cuenta, se puede volver a intentar
      attempted.current.delete(id);
      dispatch({ type: 'claim-failed', id, error: describeMutationError(reason) });
    }
  }

  function dismiss(id: string) {
    dispatch({ type: 'dismiss', id });
  }

  return { offers, claim, dismiss };
}
