/**
 * Lo que hará el borde contra la fuerza bruta (SEG-1, ADR-15: NGINX y CrowdSec, HU-BE-20): tras
 * `LOGIN_MAX_FAILURES` regresos fallidos en `LOGIN_FAILURE_WINDOW_MS` desde este origen, rechaza
 * los inicios de sesión durante `LOGIN_BLOCK_MS`. En el simulador vive en localStorage para
 * sobrevivir a la ida y vuelta al selector de cuentas.
 */
const THROTTLE_KEY = 'zeal.mock.intentos';

export const LOGIN_FAILURE_WINDOW_MS = 60_000;
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_BLOCK_MS = 60_000;

interface Throttle {
  /** Momentos de los regresos fallidos dentro de la ventana. */
  failures: number[];
  blockedUntil: number;
}

function readThrottle(): Throttle {
  const stored = JSON.parse(localStorage.getItem(THROTTLE_KEY) ?? 'null') as Throttle | null;
  return stored ?? { failures: [], blockedUntil: 0 };
}

/** Segundos que faltan para que termine el bloqueo del origen; 0 si no hay bloqueo vigente. */
export function blockedSeconds(now: number = Date.now()): number {
  return Math.max(0, Math.ceil((readThrottle().blockedUntil - now) / 1000));
}

/** Un regreso fallido (cuenta no registrada o flujo inválido); al llegar al umbral, bloquea. */
export function registerFailedLogin(now: number = Date.now()): void {
  const { failures, blockedUntil } = readThrottle();
  const recent = [...failures.filter((at) => now - at < LOGIN_FAILURE_WINDOW_MS), now];
  const next: Throttle =
    recent.length >= LOGIN_MAX_FAILURES
      ? { failures: [], blockedUntil: now + LOGIN_BLOCK_MS }
      : { failures: recent, blockedUntil };
  localStorage.setItem(THROTTLE_KEY, JSON.stringify(next));
}

/** Un ingreso correcto limpia el historial del origen. */
export function registerSuccessfulLogin(): void {
  localStorage.removeItem(THROTTLE_KEY);
}
