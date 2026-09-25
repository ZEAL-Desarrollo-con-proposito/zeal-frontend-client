import { useEffect, useReducer, useRef, useState } from 'react';
import { addDays } from '@/shared/lib/dates';
import { useRealtimeStatus, useRealtimeSubscription } from '@/shared/realtime/useRealtime';
import { fetchMySlots } from '../api/availabilityApi';
import type { Slot } from '../model/slot';
import type { SlotEvent } from '../model/slotEvent';
import { isSlotEvent, SLOTS_TOPIC } from '../model/slotEvent';
import { INITIAL_SLOTS_STATE, slotsReducer } from '../model/slotsState';

interface WeeklySlotsOptions {
  from: Date;
  to: Date;
  psychologistId: string;
  /** Cambio que llegó en vivo (p. ej. un paciente reservó una franja). */
  onRealtimeEvent: (event: SlotEvent) => void;
}

/**
 * Franjas del psicólogo para un rango de días, al día en tiempo real:
 * - cancela la petición anterior al cambiar de rango y descarta respuestas atrasadas;
 * - aplica los eventos del Real-Time Gateway (también los que llegan durante la carga);
 * - al recuperarse la conexión vuelve a pedir la semana para no perder cambios.
 */
export function useWeeklySlots({ from, to, psychologistId, onRealtimeEvent }: WeeklySlotsOptions) {
  const [state, dispatch] = useReducer(slotsReducer, INITIAL_SLOTS_STATE);
  const [attempt, setAttempt] = useState(0);
  const { recoveries } = useRealtimeStatus();
  const requestCounter = useRef(0);
  const fromTime = from.getTime();
  const toTime = to.getTime();

  useEffect(() => {
    requestCounter.current += 1;
    const requestId = requestCounter.current;
    const controller = new AbortController();
    dispatch({ type: 'load-start', requestId });
    fetchMySlots({ from: new Date(fromTime), to: new Date(toTime) }, controller.signal).then(
      (slots) => {
        dispatch({ type: 'load-success', requestId, slots });
      },
      () => {
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
