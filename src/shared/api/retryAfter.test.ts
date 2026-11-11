import { describe, expect, it } from 'vitest';
import { MAX_RETRY_AFTER_SECONDS, parseRetryAfter } from './retryAfter';

const NOW = Date.parse('2026-09-23T14:20:00.000Z');

describe('parseRetryAfter', () => {
  it.each([
    ['segundos', '45', 45],
    ['cero', '0', 0],
    ['con espacios', ' 30 ', 30],
    ['una fecha HTTP futura', new Date(NOW + 30_000).toUTCString(), 30],
    ['una fecha HTTP pasada', new Date(NOW - 5_000).toUTCString(), 0],
  ])('lee %s', (_case, value, expected) => {
    expect(parseRetryAfter(value, NOW)).toBe(expected);
  });

  it.each([
    ['ausente', null],
    ['vacía', ''],
    ['negativa', '-5'],
    ['decimal', '1.5'],
    ['fuera de rango seguro', '999999999999999999999'],
    ['fecha inválida', 'no-es-una-fecha'],
  ])('ignora una cabecera %s', (_case, value) => {
    expect(parseRetryAfter(value, NOW)).toBeNull();
  });

  it('recorta valores por encima del límite de cordura', () => {
    expect(parseRetryAfter(String(MAX_RETRY_AFTER_SECONDS + 1), NOW)).toBe(MAX_RETRY_AFTER_SECONDS);
    expect(
      parseRetryAfter(new Date(NOW + (MAX_RETRY_AFTER_SECONDS + 1) * 1000).toUTCString(), NOW),
    ).toBe(MAX_RETRY_AFTER_SECONDS);
  });
});
