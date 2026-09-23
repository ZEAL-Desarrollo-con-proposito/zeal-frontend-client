import { API_BASE_URL } from '@/shared/config/apiBaseUrl';
import { ApiError, NetworkError } from './errors';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
}

const DEFAULT_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intenta de nuevo.';

/**
 * Cliente HTTP JSON. Devuelve `unknown`: cada módulo de API valida la forma de la respuesta,
 * porque lo que llega del servidor es un límite de confianza.
 */
export async function request(path: string, { method = 'GET', body }: RequestOptions = {}) {
  const headers = new Headers({ Accept: 'application/json' });
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
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
    throw new ApiError(response.status, await readErrorMessage(response));
  }
  return (await response.json()) as unknown;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as unknown;
    if (isMessagePayload(payload)) {
      return payload.message;
    }
  } catch {
    // Cuerpo vacío o no JSON: se usa el mensaje genérico.
  }
  return DEFAULT_ERROR_MESSAGE;
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
