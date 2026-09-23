import { isRecord } from './session';

function decodeBase64Url(segment: string): string {
  const binary = atob(segment.replaceAll('-', '+').replaceAll('_', '/'));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Lee el vencimiento (claim `exp`) de un JWT en milisegundos. No valida la firma: eso le
 * corresponde al servidor. Devuelve `null` si el token no tiene la forma esperada.
 */
export function readTokenExpiry(token: string): number | null {
  const [, payloadSegment] = token.split('.');
  if (payloadSegment === undefined) {
    return null;
  }
  try {
    const payload: unknown = JSON.parse(decodeBase64Url(payloadSegment));
    if (isRecord(payload) && typeof payload.exp === 'number' && Number.isFinite(payload.exp)) {
      return payload.exp * 1000;
    }
    return null;
  } catch {
    return null;
  }
}
