import { request } from '@/shared/api/httpClient';
import { readTokenExpiry } from '../model/jwt';
import type { Session } from '../model/session';
import { isLoginResponse, isRecord } from '../model/session';

export const MICROSOFT_LOGIN_ENDPOINT = '/api/auth/microsoft';
export const REFRESH_ENDPOINT = '/api/auth/refresh';
export const LOGOUT_ENDPOINT = '/api/auth/logout';

export class InvalidSessionResponseError extends Error {
  constructor() {
    super('La respuesta del servidor de autenticación no tiene el formato esperado');
    this.name = 'InvalidSessionResponseError';
  }
}

function toSession(payload: unknown): Session {
  if (!isLoginResponse(payload)) {
    throw new InvalidSessionResponseError();
  }
  const expiresAt = readTokenExpiry(payload.accessToken);
  if (expiresAt === null) {
    throw new InvalidSessionResponseError();
  }
  return { accessToken: payload.accessToken, user: payload.user, expiresAt };
}

export interface MicrosoftLoginRequest {
  /** La cookie de renovación sobrevive al cierre del navegador. */
  remember: boolean;
  /** Ruta interna de la app a la que se vuelve después de Microsoft. */
  returnTo: string;
}

/**
 * A dónde se puede navegar: Microsoft (https) o, en el simulador, una página de la propia app.
 * Cualquier otra cosa (p. ej. `javascript:`) se rechaza aunque venga del servidor.
 */
function isSafeAuthorizationUrl(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === 'https:' || url.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Empieza el inicio de sesión con Microsoft (OpenID Connect con el backend como cliente
 * confidencial; contrato en el README): el backend guarda state, nonce y PKCE en una cookie corta
 * y responde la dirección de autorización de Microsoft. ZEAL nunca recibe la contraseña.
 */
export async function startMicrosoftLogin(login: MicrosoftLoginRequest): Promise<string> {
  const payload = await request(MICROSOFT_LOGIN_ENDPOINT, {
    method: 'POST',
    body: login,
    withRefreshCookie: true,
  });
  const authorizationUrl = isRecord(payload) ? payload.authorizationUrl : undefined;
  if (!isSafeAuthorizationUrl(authorizationUrl)) {
    throw new InvalidSessionResponseError();
  }
  return authorizationUrl;
}

/** Pide un token nuevo con la cookie de refresh; el servidor la rota en cada uso (HU-BE-22). */
export async function refreshSession(): Promise<Session> {
  const payload = await request(REFRESH_ENDPOINT, { method: 'POST', withRefreshCookie: true });
  return toSession(payload);
}

/** Revoca en el servidor la sesión de la cookie de refresh (HU-BE-22). */
export async function logout(): Promise<void> {
  await request(LOGOUT_ENDPOINT, { method: 'POST', withRefreshCookie: true });
}
