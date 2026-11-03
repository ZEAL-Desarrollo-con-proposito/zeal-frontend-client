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

/** Reintentos de una consulta (GET) que no llegó a un servidor sano antes de dar el error. */
export const MAX_RETRIES = 3;
/** Espera máxima antes del primer reintento; se duplica en cada uno (backoff exponencial). */
export const RETRY_BASE_DELAY_MS = 250;
/** Respuestas del balanceador cuando una réplica cayó, está saturada o no respondió a tiempo. */
const UNAVAILABLE_STATUSES = new Set([502, 503, 504]);

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
 *
 * Si una consulta (GET) no llega a un servidor sano (sin conexión, 502, 503 o 504), se repite
 * hasta `MAX_RETRIES` veces con espera creciente: otra réplica puede atenderla. Los envíos nunca
 * se repiten solos, porque podrían duplicar una reserva o una postulación.
 */
export async function request(path: string, options: RequestOptions = {}): Promise<unknown> {
  const send = () => sendOnce(path, options);
  return (options.method ?? 'GET') === 'GET' ? retryWhileUnavailable(send, options.signal) : send();
}

async function retryWhileUnavailable(
  send: () => Promise<unknown>,
  signal: AbortSignal | undefined,
): Promise<unknown> {
  for (let retry = 0; retry < MAX_RETRIES; retry += 1) {
    try {
      return await send();
    } catch (error) {
      if (!isUnavailable(error)) {
        throw error;
      }
    }
    await wait(retryDelayMs(retry), signal);
  }
  return send(); // Último intento: si también falla, su error llega a quien pidió.
}

/** La petición no llegó a un servidor sano; los demás errores se repetirían igual. */
function isUnavailable(error: unknown): boolean {
  return (
    error instanceof NetworkError ||
    (error instanceof ApiError && UNAVAILABLE_STATUSES.has(error.status))
  );
}

/** Espera al azar hasta el tope del reintento (jitter): las pestañas no reintentan a la vez. */
function retryDelayMs(retry: number): number {
  return randomFraction() * RETRY_BASE_DELAY_MS * 2 ** retry;
}

/** Número en [0, 1) tomado de `crypto`: Sonar marca Math.random como generador inseguro. */
function randomFraction(): number {
  const [value = 0] = crypto.getRandomValues(new Uint32Array(1));
  return value / 2 ** 32;
}

/** Espera `ms`; si quien pidió cancela, termina de inmediato con el mismo error que daría fetch. */
function wait(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const cancel = () => {
      clearTimeout(timer);
      reject(signal?.reason as Error);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', cancel);
      resolve();
    }, ms);
    signal?.addEventListener('abort', cancel, { once: true });
  });
}

async function sendOnce(
  path: string,
  { method = 'GET', body, query = {}, signal }: RequestOptions,
): Promise<unknown> {
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
