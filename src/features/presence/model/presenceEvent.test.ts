import { describe, expect, it } from 'vitest';
import { isPresenceEvent, presenceTopic } from './presenceEvent';

describe('presenceTopic', () => {
  it('es el tema de la presencia de esa persona, con el id codificado', () => {
    expect(presenceTopic('usr-psicologo-001')).toBe('/topic/presencia/usr-psicologo-001');
    expect(presenceTopic('a:b')).toBe('/topic/presencia/a%3Ab');
  });
});

describe('isPresenceEvent', () => {
  it('acepta el aviso de presencia, en línea o desconectada', () => {
    expect(isPresenceEvent({ type: 'PRESENCIA', status: 'online' })).toBe(true);
    expect(isPresenceEvent({ type: 'PRESENCIA', status: 'offline' })).toBe(true);
  });

  it.each<[string, unknown]>([
    ['no es un objeto', 'PRESENCIA'],
    ['es null', null],
    ['es de otro tipo', { type: 'NUEVO', status: 'online' }],
    ['no trae estado', { type: 'PRESENCIA' }],
    ['el estado no se conoce', { type: 'PRESENCIA', status: 'OCUPADA' }],
  ])('rechaza %s', (_caso, valor) => {
    expect(isPresenceEvent(valor)).toBe(false);
  });
});
