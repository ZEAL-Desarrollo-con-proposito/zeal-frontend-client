import { API_BASE_URL } from '@/shared/config/apiBaseUrl';
import { ApiError, NetworkError } from './errors';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  query?: Record<string, string>;
  /** Permite cancelar la petición (p. ej. al cambiar de semana antes de que responda). */
  signal?: AbortSignal;
}

const NO_CONTENT = 204;

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
 * porque lo que llega del servidor es un límite de confianza. Una respuesta 204 devuelve `null`.
 */
export async function request(
  path: string,
  { method = 'GET', body, query = {}, signal }: RequestOptions = {},
) {
  const auth = httpAuth;
  const headers = new Headers({ Accept: 'application/json' });
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (auth !== null) {
    headers.set('Authorization', `Bearer ${auth.accessToken}`);
  }
  const url = new URL(path, API_BASE_URL);
  for (const [name, value] of Object.entries(query)) {
    url.searchParams.set(name, value);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? null : JSON.stringify(body),
      signal: signal ?? null,
    });
  } catch (cause) {
    if (isAbortError(cause)) {
      throw cause; // Cancelación pedida por quien llama: no es un fallo de red.
    }
    throw new NetworkError({ cause });
  }

  if (!response.ok) {
    if (response.status === 401 && auth !== null) {
      auth.onUnauthorized(); // El token venció o fue revocado en el servidor.
    }
    throw new ApiError(response.status, await readServerMessage(response));
  }
  if (response.status === NO_CONTENT) {
    return null;
  }
  return (await response.json()) as unknown;
}

/** Compara por nombre: la excepción puede venir de otro contexto (p. ej. el fetch nativo). */
export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  );
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
