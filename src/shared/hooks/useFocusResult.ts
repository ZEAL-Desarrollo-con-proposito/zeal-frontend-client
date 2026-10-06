import { useCallback, useEffect, useRef } from 'react';

/**
 * Cuando el botón que se pulsó desaparece con el resultado (p. ej. "Postularme" → "Aceptada"), el
 * foco pasa al resultado en vez de perderse. Solo si el resultado llega tras un envío de esta
 * pantalla: si llega desde otra pestaña, el foco no se mueve.
 *
 * Devuelve la ref del resultado (enfocable con `tabIndex={-1}`); lo enfoca al montarse, es decir,
 * cuando termina de salir el botón.
 */
export function useFocusResult(done: boolean, sending: boolean) {
  const wasSending = useRef(false);
  const focusPending = useRef(false);

  useEffect(() => {
    if (done && wasSending.current) {
      focusPending.current = true;
    }
    wasSending.current = sending;
  }, [done, sending]);

  return useCallback((element: HTMLElement | null) => {
    if (element !== null && focusPending.current) {
      focusPending.current = false;
      element.focus();
    }
  }, []);
}
