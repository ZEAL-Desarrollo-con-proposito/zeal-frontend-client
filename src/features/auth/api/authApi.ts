import { request } from '@/shared/api/httpClient';
import type { Credentials, Session } from '../model/session';
import { isSession } from '../model/session';

export const LOGIN_ENDPOINT = '/api/auth/login';

export class InvalidSessionResponseError extends Error {
  constructor() {
    super('La respuesta del servidor de autenticación no tiene el formato esperado');
    this.name = 'InvalidSessionResponseError';
  }
}

/** Autentica con correo y contraseña (contrato con HU-BE-01, documentado en el README). */
export async function login(credentials: Credentials): Promise<Session> {
  const payload = await request(LOGIN_ENDPOINT, { method: 'POST', body: credentials });
  if (!isSession(payload)) {
    throw new InvalidSessionResponseError();
  }
  return { accessToken: payload.accessToken, user: payload.user };
}
