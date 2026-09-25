import { useEffect, useEffectEvent, useReducer, useRef, useState } from 'react';

export type LoadStatus = 'loading' | 'ready' | 'error';

interface FetchState<T> {
  requestId: number;
  status: LoadStatus;
  data: T | null;
}

type FetchAction<T> =
  | { type: 'start'; requestId: number }
  | { type: 'success'; requestId: number; data: T }
  | { type: 'failure'; requestId: number };

/** Solo la petición vigente cambia el estado: una respuesta atrasada nunca pisa a la última. */
export function fetchReducer<T>(state: FetchState<T>, action: FetchAction<T>): FetchState<T> {
  if (action.type === 'start') {
    return { ...state, requestId: action.requestId, status: 'loading' };
  }
  if (action.requestId !== state.requestId) {
    return state;
  }
  return action.type === 'success'
    ? { ...state, status: 'ready', data: action.data }
    : { ...state, status: 'error' };
}

/**
 * Carga datos del servidor para una clave (p. ej. un rango de fechas). Al cambiar la clave
 * cancela la petición anterior; `reload` vuelve a pedirlos (reintento o aviso en tiempo real).
 */
export function useFetch<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [state, dispatch] = useReducer(fetchReducer<T>, {
    requestId: 0,
    status: 'loading',
    data: null,
  });
  const [attempt, setAttempt] = useState(0);
  const counter = useRef(0);
  const run = useEffectEvent(load);

  useEffect(() => {
    counter.current += 1;
    const requestId = counter.current;
    const controller = new AbortController();
    dispatch({ type: 'start', requestId });
    run(controller.signal).then(
      (data) => {
        dispatch({ type: 'success', requestId, data });
      },
      () => {
        dispatch({ type: 'failure', requestId });
      },
    );
    return () => {
      controller.abort();
    };
  }, [key, attempt]);

  function reload() {
    setAttempt((current) => current + 1);
  }

  return { status: state.status, data: state.data, reload };
}
