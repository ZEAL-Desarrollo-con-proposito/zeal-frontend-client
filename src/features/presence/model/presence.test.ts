import { describe, expect, it } from 'vitest';
import type { PresenceSnapshot } from './presence';
import { isPresenceSnapshot } from './presence';

const EN_LINEA: PresenceSnapshot = { userId: 'usr-psicologo-001', status: 'online' };

describe('isPresenceSnapshot', () => {
  it('acepta la presencia que entrega el servidor, en línea o desconectada', () => {
    expect(isPresenceSnapshot(EN_LINEA)).toBe(true);
    expect(isPresenceSnapshot({ ...EN_LINEA, status: 'offline' })).toBe(true);
  });

  it.each<[string, unknown]>([
    ['un valor que no es objeto', 'online'],
    ['es null', null],
    ['no tiene persona', { status: 'online' }],
    ['la persona no es texto', { ...EN_LINEA, userId: 7 }],
    ['no tiene estado', { userId: EN_LINEA.userId }],
    ['un estado desconocido', { ...EN_LINEA, status: 'OCUPADA' }],
  ])('rechaza %s', (_caso, valor) => {
    expect(isPresenceSnapshot(valor)).toBe(false);
  });
});
