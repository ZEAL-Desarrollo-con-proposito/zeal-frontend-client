import { useRef, useState } from 'react';

/**
 * Envíos en curso por elemento (p. ej. por convocatoria o por taller): mientras uno espera al
 * servidor, un segundo envío del mismo elemento se descarta. El bloqueo es inmediato: dos clics
 * antes de volver a pintar no envían dos veces.
 */
export function useSubmitting() {
  const [submittingIds, setSubmittingIds] = useState<ReadonlySet<string>>(new Set());
  const active = useRef(new Set<string>());

  function mark(id: string, submitting: boolean) {
    if (submitting) {
      active.current.add(id);
    } else {
      active.current.delete(id);
    }
    setSubmittingIds(new Set(active.current));
  }

  async function submit(id: string, task: () => Promise<void>): Promise<void> {
    if (active.current.has(id)) {
      return;
    }
    mark(id, true);
    try {
      await task();
    } finally {
      mark(id, false);
    }
  }

  return { isSubmitting: (id: string) => submittingIds.has(id), submit };
}
