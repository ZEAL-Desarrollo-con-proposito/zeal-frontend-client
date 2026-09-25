import { describe, expect, it } from 'vitest';
import { getFirstName, getInitials } from './text';

describe('getInitials', () => {
  it.each([
    ['Laura Martínez', 'LM'],
    [' david  santiago cajamarca ', 'DS'],
    ['Nexura', 'N'],
  ])('obtiene las iniciales de "%s"', (fullName, expected) => {
    expect(getInitials(fullName)).toBe(expected);
  });
});

describe('getFirstName', () => {
  it.each([
    ['Laura Martínez', 'Laura'],
    ['  David   Santiago Cajamarca ', 'David'],
    ['Nexura', 'Nexura'],
  ])('obtiene el primer nombre de "%s"', (fullName, expected) => {
    expect(getFirstName(fullName)).toBe(expected);
  });
});
