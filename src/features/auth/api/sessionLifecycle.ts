import { ApiError } from '@/shared/api/errors';
import type { Session } from '../model/session';
import { logout, refreshSession } from './authApi';

/** Candado entre pestañas de la renovación. */
const RENEWAL_LOCK = 'zeal.auth.renovacion';
/** Marca de un cierre de sesión que no llegó al servidor. No es un secreto. */
export const PENDING_LOGOUT_KEY = 'zeal.logout.pendiente';

let renewal: Promise<Session> | null = null;

/** La sesión queda en manos de una pestaña a la vez, porque el servidor rota la cookie en cada uso. */
function oneTabAtATime(task: () => Promise<Session>): Promise<Session> {
  return 'locks' in navigator ? navigator.locks.request(RENEWAL_LOCK, task) : task();
}

/**
 * Renueva la sesión. Solo una renovación a la vez: si dos pestañas (o dos peticiones) gastaran la
 * misma cookie, el servidor lo tomaría por un token robado y revocaría la sesión (escenario SEG-4).
 */
export function renewSession(): Promise<Session> {
  renewal ??= oneTabAtATime(refreshSession).finally(() => {
    renewal = null;
  });
  return renewal;
}

function isLogoutPending(): boolean {
  try {
    return localStorage.getItem(PENDING_LOGOUT_KEY) !== null;
  } catch {
    return false;
  }
}

export function setLogoutPending(pending: boolean): void {
  try {
    if (pending) {
      localStorage.setItem(PENDING_LOGOUT_KEY, 'true');
    } else {
      localStorage.removeItem(PENDING_LOGOUT_KEY);
    }
  } catch {
    // Sin almacenamiento no hay dónde recordarlo: queda como un cierre de sesión normal.
  }
}

/**
 * Revoca la sesión en el servidor. La cookie de refresh no se puede borrar desde aquí: si no hay
 * con quién revocarla, se recuerda para no volver a entrar con ella y revocarla en la próxima visita.
 */
export async function revokeSession(): Promise<void> {
  try {
    await logout();
    setLogoutPending(false);
  } catch (error) {
    // Un rechazo (4xx) significa que la cookie ya no servía: no queda nada por revocar.
    setLogoutPending(!(error instanceof ApiError && error.status < 500));
  }
}

/** Al abrir la app: recupera la sesión con la cookie de refresh; `null` si no hay ninguna vigente. */
export async function restoreSession(): Promise<Session | null> {
  if (isLogoutPending()) {
    await revokeSession();
    return null;
  }
  try {
    return await renewSession();
  } catch {
    return null;
  }
}
