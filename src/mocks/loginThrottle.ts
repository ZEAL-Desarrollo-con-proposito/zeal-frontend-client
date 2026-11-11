export const LOGIN_FAILURE_WINDOW_MS = 60_000;
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_BLOCK_MS = 60_000;

let failures: number[] = [];
let blockedUntil = 0;

/** Segundos que faltan para que termine el bloqueo del origen; 0 si no hay bloqueo vigente. */
export function blockedSeconds(now: number = Date.now()): number {
  return Math.max(0, Math.ceil((blockedUntil - now) / 1000));
}

/** Registra un 401 y, al superar el umbral dentro de la ventana, bloquea el origen. */
export function registerFailedLogin(now: number = Date.now()): void {
  failures = failures.filter((attempt) => now - attempt < LOGIN_FAILURE_WINDOW_MS);
  failures.push(now);
  if (failures.length >= LOGIN_MAX_FAILURES) {
    failures = [];
    blockedUntil = now + LOGIN_BLOCK_MS;
  }
}

/** Un ingreso correcto limpia el historial de fallos del origen. */
export function registerSuccessfulLogin(): void {
  failures = [];
  blockedUntil = 0;
}

/** Vuelve al estado inicial entre pruebas. */
export function resetLoginThrottle(): void {
  failures = [];
  blockedUntil = 0;
}
