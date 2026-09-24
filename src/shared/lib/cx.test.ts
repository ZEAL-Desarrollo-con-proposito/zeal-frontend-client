import { describe, expect, it } from 'vitest';
import { cx } from './cx';

describe('cx', () => {
  it('une las clases válidas e ignora los valores vacíos', () => {
    expect(cx('base', false, null, undefined, '', 'extra')).toBe('base extra');
  });
});
