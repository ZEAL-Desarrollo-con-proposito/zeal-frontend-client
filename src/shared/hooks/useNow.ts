import { useEffect, useState } from 'react';

export const NOW_REFRESH_MS = 30_000;

/**
 * Hora actual que se refresca sola: permite que un botón se habilite cuando llega su hora
 * (p. ej. "Entrar a la sala") sin recargar la página.
 */
export function useNow(refreshMs: number = NOW_REFRESH_MS): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, refreshMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [refreshMs]);

  return now;
}
