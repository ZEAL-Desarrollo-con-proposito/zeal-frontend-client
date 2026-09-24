import { API_BASE_URL } from '@/shared/config/apiBaseUrl';
import { ApiError, NetworkError } from './errors';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
}

/** Credencial de la sesión activa y reacción cuando el servidor la rechaza. */
export interface HttpAuth {
  accessToken: string;
  onUnauthorized: () => void;
}

let httpAuth: HttpAuth | null = null;

/** La sesión registra aquí su token; `null` al cerrarla. Mantiene al cliente HTTP ajeno a auth. */
export function configureHttpAuth(auth: HttpAuth | null): void {
  httpAuth = auth;
}

/**
 * Cliente HTTP JSON. Devuelve `unknown`: cada módulo de API valida la forma de la respuesta,
 * porque lo que llega del servidor es un límite de confianza.
 */
export async function request(path: string, { method = 'GET', body }: RequestOptions = {}) {
  const auth = httpAuth;
  const headers = new Headers({ Accept: 'application/json' });
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (auth !== null) {
    headers.set('Authorization', `Bearer ${auth.accessToken}`);
  }

  let response: Response;
  try {
    response = await fetch(new URL(path, API_BASE_URL), {
      method,
      headers,
      body: body === undefined ? null : JSON.stringify(body),
    });
  } catch (cause) {
    throw new NetworkError({ cause });
  }

  if (!response.ok) {
    if (response.status === 401 && auth !== null) {
      auth.onUnauthorized(); // El token venció o fue revocado en el servidor.
    }
    throw new ApiError(response.status, await readServerMessage(response));
  }
  return (await response.json()) as unknown;
}

async function readServerMessage(response: Response): Promise<string | undefined> {
  try {
    const payload = (await response.json()) as unknown;
    return isMessagePayload(payload) ? payload.message : undefined;
  } catch {
    return undefined; // Cuerpo vacío o que no es JSON.
  }
}

function isMessagePayload(payload: unknown): payload is { message: string } {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'message' in payload &&
    typeof payload.message === 'string' &&
    payload.message.trim() !== ''
  );
}
