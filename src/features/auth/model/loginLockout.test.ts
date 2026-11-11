import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api/errors';
import {
  DEFAULT_LOGIN_LOCKOUT_SECONDS,
  formatLoginLockoutCountdown,
  formatLoginLockoutDeadline,
  isLoginLockout,
  toLoginLockout,
} from './loginLockout';

const NOW = Date.parse('2026-09-23T14:20:00.000Z');

describe('toLoginLockout', () => {
  it.each([
    ['429 con segundos', new ApiError(429, undefined, 30), 30],
    ['429 sin cabecera', new ApiError(429), DEFAULT_LOGIN_LOCKOUT_SECONDS],
    ['429 con cero', new ApiError(429, undefined, 0), 1],
    ['403 del bouncer con Retry-After', new ApiError(403, undefined, 15), 15],
    ['403 del bouncer sin Retry-After', new ApiError(403), DEFAULT_LOGIN_LOCKOUT_SECONDS],
    ['403 del bouncer con cero', new ApiError(403, undefined, 0), 1],
  ])('reconoce un %s', (_case, error, seconds) => {
    expect(toLoginLockout(error, NOW)).toEqual({
      startedAt: NOW,
      until: NOW + seconds * 1000,
    });
  });

  it.each([
    ['otro error', new Error('x')],
    ['401', new ApiError(401)],
  ])('no confunde %s con un bloqueo', (_case, error) => {
    expect(toLoginLockout(error, NOW)).toBeNull();
  });
});

describe('isLoginLockout', () => {
  it('distingue el bloqueo de un rechazo de credenciales', () => {
    expect(isLoginLockout(new ApiError(429))).toBe(true);
    expect(isLoginLockout(new ApiError(403))).toBe(true);
    expect(isLoginLockout(new ApiError(401))).toBe(false);
  });
});

describe('formatLoginLockoutCountdown', () => {
  it.each([
    [65_000, '1:05'],
    [59_001, '1:00'],
    [3_599_000, '59:59'],
    [3_600_000, '1 h'],
    [3_661_000, '1 h 1 min'],
    [86_400_000, '1 d'],
    [90_000_000, '1 d 1 h'],
    [3_600_000_000, '41 d 16 h'],
    [0, '0:00'],
  ])('formatea %i ms como %s', (remaining, expected) => {
    expect(formatLoginLockoutCountdown(remaining)).toBe(expected);
  });
});

describe('formatLoginLockoutDeadline', () => {
  const NOW_LOCAL = new Date(2026, 8, 23, 9, 20).getTime();

  it('usa solo la hora cuando el bloqueo vence el mismo día', () => {
    const until = new Date(2026, 8, 23, 14, 30).getTime();

    expect(formatLoginLockoutDeadline(until, NOW_LOCAL)).toBe('hoy a las 14:30');
  });

  it('incluye la fecha cuando el bloqueo vence otro día', () => {
    const until = new Date(2026, 8, 25, 10, 0).getTime();

    expect(formatLoginLockoutDeadline(until, NOW_LOCAL)).toBe(
      'el Viernes, 25 de septiembre a las 10:00',
    );
  });

  it('incluye el año cuando el bloqueo cruza de año', () => {
    const until = new Date(2027, 0, 2, 8, 5).getTime();

    expect(formatLoginLockoutDeadline(until, NOW_LOCAL)).toBe(
      'el Sábado, 2 de enero de 2027 a las 8:05',
    );
  });
});
