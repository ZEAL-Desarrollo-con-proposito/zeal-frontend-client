import { useEffect, useEffectEvent, useMemo, useReducer, useRef, useState } from 'react';
import type { LiveCollectionState, Versioned } from './liveCollection';
import { INITIAL_LIVE_COLLECTION, liveCollectionReducer } from './liveCollection';
import { useRealtimeStatus, useRealtimeSubscription } from './useRealtime';

interface LiveCollectionOptions<T> {
  load: (signal: AbortSignal) => Promise<T[]>;
  /** Cola o canal por donde el servidor avisa altas y cambios. */
  queue: string;
  /** El elemento que trae un aviso, o `null` si el aviso no corresponde. */
  read: (payload: unknown) => T | null;
  /** Orden en que se muestran (estable entre renders: una función del módulo). */
  compare: (a: T, b: T) => number;
}

/**
 * Colección de la persona al día en tiempo real (p. ej. sus postulaciones o inscripciones):
 * - se carga al entrar y se vuelve a pedir al recuperarse la conexión;
 * - lo que se crea o cambia en otra pestaña o equipo llega por la cola, también durante la carga;
 * - siempre gana la versión más nueva de cada elemento.
 */
export function useLiveCollection<T extends Versioned>({
  load,
  queue,
  read,
  compare,
}: LiveCollectionOptions<T>) {
  const [state, dispatch] = useReducer(
    liveCollectionReducer<T>,
    INITIAL_LIVE_COLLECTION as LiveCollectionState<T>,
  );
  const [attempt, setAttempt] = useState(0);
  const requestCounter = useRef(0);
  const { recoveries } = useRealtimeStatus();
  const loadItems = useEffectEvent(load);

  useEffect(() => {
    requestCounter.current += 1;
    const requestId = requestCounter.current;
    const controller = new AbortController();
    dispatch({ type: 'load-start', requestId });
    loadItems(controller.signal).then(
      (items) => {
        dispatch({ type: 'load-success', requestId, items });
      },
      () => {
        dispatch({ type: 'load-failure', requestId });
      },
    );
    return () => {
      controller.abort();
    };
  }, [attempt, recoveries]);

  useRealtimeSubscription(queue, (payload) => {
    const item = read(payload);
    if (item !== null) {
      dispatch({ type: 'received', item });
    }
  });

  const items = useMemo(() => [...state.items].sort(compare), [state.items, compare]);

  return {
    status: state.status,
    items,
    /** Aplica un elemento que confirmó el servidor (p. ej. la respuesta a una acción). */
    received: (item: T) => {
      dispatch({ type: 'received', item });
    },
    reload: () => {
      setAttempt((current) => current + 1);
    },
  };
}
