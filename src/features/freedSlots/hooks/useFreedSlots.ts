import { useReducer, useRef } from 'react';
import { describeMutationError } from '@/shared/api/describeError';
import { ApiError } from '@/shared/api/errors';
import { useRealtimeSubscription } from '@/shared/realtime/useRealtime';
import { claimFreedSlot } from '../api/freedSlotsApi';
import { remainingMs } from '../model/freedSlot';
import { FREED_SLOTS_QUEUE, isFreedSlotEvent } from '../model/freedSlotEvent';
import { freedSlotsReducer, INITIAL_FREED_SLOTS_STATE } from '../model/freedSlotsState';

/**
 * Cupos liberados que le llegan a la persona por su cola privada (HU-FE-08):
 * - cada cupo nuevo aparece al instante, sin recargar, y se anuncia una sola vez;
 * - si otra persona lo toma antes, la alerta se actualiza sola;
 * - `claim` compite por el cupo: solo el primer clic viaja al servidor (el resto se ignora, incluso
 *   si llega antes de que React vuelva a pintar) y el servidor decide quién gana.
 */
export function useFreedSlots() {
  const [offers, dispatch] = useReducer(freedSlotsReducer, INITIAL_FREED_SLOTS_STATE);
  /** Cupos ya anunciados: si un evento llega dos veces (o tras cerrar la alerta) no reaparece. */
  const announced = useRef(new Set<string>());
  /** Cupos con un intento en curso o ya resuelto: bloquea el segundo clic de inmediato. */
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
    // Un cupo que ya venció al llegar (p. ej. tras reconectar) no sirve de nada mostrarlo.
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
      // El servidor respondió: 409 = otra persona lo tomó primero; cualquier otro 4xx = ya no está.
      if (reason instanceof ApiError && reason.status < 500) {
        const detail = reason.serverMessage;
        dispatch(
          reason.status === 409
            ? { type: 'claim-lost', id, detail }
            : { type: 'claim-gone', id, detail },
        );
        return;
      }
      // Sin conexión o error interno: el intento no cuenta, se puede volver a intentar.
      attempted.current.delete(id);
      dispatch({ type: 'claim-failed', id, error: describeMutationError(reason) });
    }
  }

  function dismiss(id: string) {
    dispatch({ type: 'dismiss', id });
  }

  return { offers, claim, dismiss };
}
