import { useEffect, useEffectEvent, useReducer, useRef, useState } from 'react';
import type { ApiError } from '@/shared/api/errors';
import { isForbidden } from '@/shared/api/errors';
import type { DateRange } from '@/shared/lib/dates';
import { addDays } from '@/shared/lib/dates';
import { useRealtimeStatus, useRealtimeSubscription } from '@/shared/realtime/useRealtime';
import type { Slot } from '../model/slot';
import type { SlotEvent } from '../model/slotEvent';
import { isSlotEvent, SLOTS_TOPIC } from '../model/slotEvent';
import { INITIAL_SLOTS_STATE, slotsReducer } from '../model/slotsState';

interface WeeklySlotsOptions {
  from: Date;
  to: Date;
  psychologistId: string;
  /** Cómo se piden las franjas del rango (las propias del psicólogo, o las libres para un empleado). */
  load: (range: DateRange, signal: AbortSignal) => Promise<Slot[]>;
  /** Cambio que llegó en vivo (p. ej. un paciente reservó una franja). */
  onRealtimeEvent: (event: SlotEvent) => void;
}

/**
 * Franjas de un psicólogo para un rango de días, al día en tiempo real:
 * - cancela la petición anterior al cambiar de rango y descarta respuestas atrasadas;
 * - aplica los eventos del Real-Time Gateway (también los que llegan durante la carga);
 * - al recuperarse la conexión vuelve a pedir la semana para no perder cambios.
 * Un 403 no se reintenta: se lanza para que la ruta muestre "Permiso denegado".
 */
export function useWeeklySlots({
  from,
  to,
  psychologistId,
  load,
  onRealtimeEvent,
}: WeeklySlotsOptions) {
  const [state, dispatch] = useReducer(slotsReducer, INITIAL_SLOTS_STATE);
  const [attempt, setAttempt] = useState(0);
  const [denied, setDenied] = useState<ApiError | null>(null);
  const { recoveries } = useRealtimeStatus();
  const requestCounter = useRef(0);
  const fromTime = from.getTime();
  const toTime = to.getTime();
  const loadRange = useEffectEvent(load);

  useEffect(() => {
    requestCounter.current += 1;
    const requestId = requestCounter.current;
    const controller = new AbortController();
    dispatch({ type: 'load-start', requestId });
    loadRange({ from: new Date(fromTime), to: new Date(toTime) }, controller.signal).then(
      (slots) => {
        dispatch({ type: 'load-success', requestId, slots });
      },
      (error: unknown) => {
        if (isForbidden(error)) {
          setDenied(error);
          return;
        }
        dispatch({ type: 'load-failure', requestId });
      },
    );
    return () => {
      controller.abort();
    };
  }, [fromTime, toTime, attempt, recoveries]);

  useRealtimeSubscription(SLOTS_TOPIC, (payload) => {
    if (isSlotEvent(payload) && payload.slot.psychologistId === psychologistId) {
      dispatch({ type: 'event', event: payload });
      onRealtimeEvent(payload);
    }
  });

  if (denied !== null) {
    throw denied;
  }

  function retry() {
    setAttempt((current) => current + 1);
  }

  /** Aplica una franja confirmada por el servidor (idempotente). */
  function addSlot(slot: Slot) {
    dispatch({ type: 'created', slot });
  }

  function removeSlot(id: string) {
    dispatch({ type: 'removed', id });
  }

  // Los eventos pueden traer franjas de otras semanas: solo se muestran las del rango visible.
  const rangeEnd = addDays(new Date(toTime), 1).getTime();
  const slots = state.slots.filter((slot) => {
    const start = Date.parse(slot.startsAt);
    return start >= fromTime && start < rangeEnd;
  });

  return { status: state.status, slots, retry, addSlot, removeSlot };
}
