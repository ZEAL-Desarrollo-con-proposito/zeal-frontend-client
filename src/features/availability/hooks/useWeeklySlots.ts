import { useEffect, useReducer, useRef, useState } from 'react';
import { fetchMySlots } from '../api/availabilityApi';
import { INITIAL_SLOTS_STATE, slotsReducer } from '../model/slotsState';

/**
 * Franjas del psicólogo para un rango de días. Cancela la petición anterior al cambiar de rango
 * y descarta respuestas atrasadas, así la semana visible nunca muestra datos de otra.
 */
export function useWeeklySlots(from: Date, to: Date) {
  const [state, dispatch] = useReducer(slotsReducer, INITIAL_SLOTS_STATE);
  const [attempt, setAttempt] = useState(0);
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
  }, [fromTime, toTime, attempt]);

  function retry() {
    setAttempt((current) => current + 1);
  }

  return { ...state, retry };
}
