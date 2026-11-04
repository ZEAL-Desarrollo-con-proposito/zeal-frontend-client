import { request } from '@/shared/api/httpClient';
import { readTokenExpiry } from '../model/jwt';
import type { Credentials, Session } from '../model/session';
import { isLoginResponse } from '../model/session';

export const LOGIN_ENDPOINT = '/api/auth/login';
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

/**
 * Autentica con correo y contraseña (contrato con HU-BE-01 y HU-BE-22, documentado en el README).
 * `remember` decide si la cookie de refresh sobrevive al cierre del navegador.
 */
export async function login(credentials: Credentials, remember: boolean): Promise<Session> {
  const payload = await request(LOGIN_ENDPOINT, {
    method: 'POST',
    body: { ...credentials, remember },
    withRefreshCookie: true,
  });
  return toSession(payload);
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
