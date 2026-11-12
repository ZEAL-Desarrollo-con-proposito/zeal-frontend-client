import { delay, http, HttpResponse } from 'msw';
import { MICROSOFT_LOGIN_ENDPOINT } from '@/features/auth/api/authApi';
import { errorBody } from '../mockAuth';
import { startRefreshFamily } from '../refreshSession';
import { findSeedUserByEmail } from '../seedUsers';
import { blockedSeconds, registerFailedLogin, registerSuccessfulLogin } from './loginThrottle';
import { startPendingLogin, takePendingLogin } from './pendingLogins';

/** Página del simulador que reemplaza a login.microsoftonline.com. */
export const MICROSOFT_SIMULATOR_PATH = '/simulador/microsoft';
/** Lo que el selector de cuentas envía en lugar del regreso de Microsoft al callback. */
export const MICROSOFT_SIMULATOR_ENDPOINT = `${MICROSOFT_LOGIN_ENDPOINT}/simulador`;
/** Cuenta de Microsoft que existe pero no está registrada en ZEAL. */
export const UNREGISTERED_ACCOUNT = 'persona@outlook.com';

/** Solo rutas internas de la app: nada de `//otro-sitio` ni direcciones absolutas. */
function isInternalPath(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//');
}

interface StartBody {
  remember?: unknown;
  returnTo?: unknown;
}

interface SimulatorBody {
  state?: unknown;
  /** Cuenta elegida en el selector; `null` si la persona canceló. */
  email?: unknown;
}

/** Un regreso fallido cuenta para el bloqueo por fuerza bruta (SEG-1). */
function failedReturn(error: 'fallo' | 'cuenta_no_registrada') {
  registerFailedLogin();
  return HttpResponse.json({ redirectTo: `/login?error=${error}` });
}

/**
 * Inicio de sesión con Microsoft como lo hará el backend (tarea 484): la dirección de autorización
 * apunta al selector de cuentas del simulador y su regreso hace lo del callback real. Delante, el
 * borde frena la fuerza bruta (SEG-1) como lo hará NGINX: `429` con `Retry-After`.
 */
export const microsoftLoginHandlers = [
  http.post<never, StartBody>(`*${MICROSOFT_LOGIN_ENDPOINT}`, async ({ request }) => {
    await delay();
    const blocked = blockedSeconds();
    if (blocked > 0) {
      return HttpResponse.json(
        { status: 429, error: 'Too Many Requests', message: 'Demasiados intentos desde esta red' },
        { status: 429, headers: { 'Retry-After': String(blocked) } },
      );
    }
    const { remember, returnTo } = await request.json();
    if (typeof remember !== 'boolean' || !isInternalPath(returnTo)) {
      return errorBody(400, 'Bad Request', 'La ruta de regreso debe ser interna.');
    }
    const state = startPendingLogin({ remember, returnTo });
    return HttpResponse.json({
      authorizationUrl: `${MICROSOFT_SIMULATOR_PATH}?state=${encodeURIComponent(state)}`,
    });
  }),

  http.post<never, SimulatorBody>(`*${MICROSOFT_SIMULATOR_ENDPOINT}`, async ({ request }) => {
    await delay();
    const { state, email } = await request.json();
    const pending = typeof state === 'string' ? takePendingLogin(state) : null;
    if (pending === null) {
      return failedReturn('fallo');
    }
    // Cancelar en Microsoft no es un intento fallido: la persona desistió.
    if (email === null) {
      return HttpResponse.json({ redirectTo: '/login?error=cancelado' });
    }
    const user = typeof email === 'string' ? findSeedUserByEmail(email) : undefined;
    if (user === undefined) {
      return failedReturn('cuenta_no_registrada');
    }
    registerSuccessfulLogin();
    startRefreshFamily(user.id, pending.remember);
    return HttpResponse.json({ redirectTo: pending.returnTo });
  }),
];
