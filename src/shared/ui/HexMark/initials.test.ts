import { describe, expect, it } from 'vitest';
import { titleInitials, toneFor } from './initials';

describe('hexágono de iniciales', () => {
  it('usa las iniciales de las dos primeras palabras con significado', () => {
    expect(titleInitials('Squad de Observabilidad')).toBe('SO');
    expect(titleInitials('Data Platform · Turno de guardia')).toBe('DP');
    expect(titleInitials('  mentoría inversa Gen Z')).toBe('MI');
  });

  it('asigna un color estable a cada id', () => {
    expect(toneFor('a')).toBe('mauve');
    expect(toneFor('b')).toBe('teal');
    expect(toneFor('c')).toBe('sage');
    expect(toneFor('a')).toBe(toneFor('a'));
  });
});
