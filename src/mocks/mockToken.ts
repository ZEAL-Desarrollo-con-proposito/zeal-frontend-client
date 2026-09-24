import type { AuthUser } from '@/features/auth/model/session';

export const MOCK_TOKEN_TTL_SECONDS = 60 * 60;

function base64UrlEncode(value: object): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const binary = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('');
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlDecode(segment: string): unknown {
  const binary = atob(segment.replaceAll('-', '+').replaceAll('_', '/'));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Sujeto (`sub`) del token que envía el cliente; `null` si no es un token del simulador. */
export function readMockTokenSubject(token: string): string | null {
  try {
    const payload = base64UrlDecode(token.split('.')[1] ?? '');
    if (typeof payload === 'object' && payload !== null && 'sub' in payload) {
      return String(payload.sub);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * JWT con la misma forma que emitirá el backend (sub, role, iat, exp). La firma es ficticia:
 * el frontend nunca valida firmas, eso lo hace el servidor en cada petición.
 */
export function createMockToken(user: AuthUser, issuedAtMs: number = Date.now()): string {
  const issuedAt = Math.floor(issuedAtMs / 1000);
  const header = base64UrlEncode({ alg: 'HS256', typ: 'JWT' });
  const payload = base64UrlEncode({
    sub: user.id,
    role: user.role,
    iat: issuedAt,
    exp: issuedAt + MOCK_TOKEN_TTL_SECONDS,
  });
  return `${header}.${payload}.firma-simulada`;
}
