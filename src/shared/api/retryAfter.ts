const SECONDS_PATTERN = /^\d+$/;

/** Límite de cordura: evita valores absurdos sin recortar bloqueos reales habituales. */
export const MAX_RETRY_AFTER_SECONDS = 10 * 365 * 24 * 60 * 60;

function clampRetryAfter(seconds: number): number {
  return Math.min(seconds, MAX_RETRY_AFTER_SECONDS);
}

/**
 * Lee la cabecera `Retry-After` (RFC 9110): segundos o una fecha HTTP. Devuelve los segundos que
 * faltan, redondeados hacia arriba; `null` si la cabecera falta o no es válida.
 */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  if (SECONDS_PATTERN.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isSafeInteger(seconds) ? clampRetryAfter(seconds) : null;
  }
  if (!Number.isNaN(Number(trimmed))) {
    return null; // Numérico pero fuera del formato de segundos (negativo, decimal, hexadecimal).
  }
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) {
    return null;
  }
  return clampRetryAfter(Math.max(0, Math.ceil((date - now) / 1000)));
}
