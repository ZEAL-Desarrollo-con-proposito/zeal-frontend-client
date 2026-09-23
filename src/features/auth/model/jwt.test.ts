import { describe, expect, it } from 'vitest';
import { createMockToken, MOCK_TOKEN_TTL_SECONDS } from '@/mocks/mockToken';
import { seedUser } from '@/test/credentials';
import { readTokenExpiry } from './jwt';

function tokenWithPayload(payload: string): string {
  return `e30.${btoa(payload).replaceAll('=', '')}.firma`;
}

describe('readTokenExpiry', () => {
  it('lee el claim exp en milisegundos', () => {
    const issuedAtMs = Date.UTC(2026, 8, 23, 12, 0, 0);

    const token = createMockToken(seedUser('PSICOLOGO'), issuedAtMs);

    expect(readTokenExpiry(token)).toBe(issuedAtMs + MOCK_TOKEN_TTL_SECONDS * 1000);
  });

  it.each([
    ['sin segmentos', 'token-opaco'],
    ['con base64 inválido', 'e30.%%%.firma'],
    ['con un payload que no es JSON', tokenWithPayload('no-json')],
    ['sin exp', tokenWithPayload('{"sub":"1"}')],
    ['con exp no numérico', tokenWithPayload('{"exp":"mañana"}')],
    ['con un payload que no es objeto', tokenWithPayload('42')],
  ])('devuelve null para un token %s', (_case, token) => {
    expect(readTokenExpiry(token)).toBeNull();
  });
});
