import { useRef, useState } from 'react';

/**
 * Envíos en curso por elemento (p. ej. por convocatoria o por taller): mientras uno espera al
 * servidor, un segundo envío del mismo elemento no sale; recibe el resultado del que ya está en
 * curso. El bloqueo es inmediato: dos clics antes de volver a pintar no envían dos veces.
 */
export function useSubmitting<T = void>() {
  const [submittingIds, setSubmittingIds] = useState<ReadonlySet<string>>(new Set());
  const inFlight = useRef(new Map<string, Promise<T>>());

  function publish() {
    setSubmittingIds(new Set(inFlight.current.keys()));
  }

  function submit(id: string, task: () => Promise<T>): Promise<T> {
    const current = inFlight.current.get(id);
    if (current !== undefined) {
      return current;
    }
    const sending = task().finally(() => {
      inFlight.current.delete(id);
      publish();
    });
    inFlight.current.set(id, sending);
    publish();
    return sending;
  }

  return { isSubmitting: (id: string) => submittingIds.has(id), submit };
}
