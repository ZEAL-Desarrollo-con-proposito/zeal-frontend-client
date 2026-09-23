import { describe, expect, it } from 'vitest';
import { formatLongDate, getFirstName } from './text';

describe('getFirstName', () => {
  it.each([
    ['Laura Martínez', 'Laura'],
    ['  David   Santiago Cajamarca ', 'David'],
    ['Nexura', 'Nexura'],
  ])('obtiene el primer nombre de "%s"', (fullName, expected) => {
    expect(getFirstName(fullName)).toBe(expected);
  });
});

describe('formatLongDate', () => {
  it('formatea la fecha en español con mayúscula inicial', () => {
    expect(formatLongDate(new Date(2026, 8, 23))).toBe('Miércoles, 23 de septiembre');
  });
});
