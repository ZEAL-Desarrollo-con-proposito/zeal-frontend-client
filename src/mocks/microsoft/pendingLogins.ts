/**
 * Inicios de sesión con Microsoft que esperan el regreso (lo que el backend real guarda en una
 * cookie corta: state, nonce y verificador PKCE). En el simulador viven en localStorage para
 * sobrevivir a la navegación de ida y vuelta.
 */
const PENDING_KEY = 'zeal.mock.microsoft';

export interface PendingLogin {
  remember: boolean;
  returnTo: string;
}

type Pending = Record<string, PendingLogin>;

function readPending(): Pending {
  return JSON.parse(localStorage.getItem(PENDING_KEY) ?? '{}') as Pending;
}

/** Guarda el intento y devuelve su `state`, que viaja a Microsoft y vuelve en el callback. */
export function startPendingLogin(login: PendingLogin): string {
  const state = crypto.randomUUID();
  localStorage.setItem(PENDING_KEY, JSON.stringify({ ...readPending(), [state]: login }));
  return state;
}

/** El intento de ese `state`, una sola vez (un regreso repetido o inventado no sirve). */
export function takePendingLogin(state: string): PendingLogin | null {
  const pending = readPending();
  const login = pending[state];
  if (login === undefined) {
    return null;
  }
  localStorage.setItem(
    PENDING_KEY,
    JSON.stringify(Object.fromEntries(Object.entries(pending).filter(([key]) => key !== state))),
  );
  return login;
}
