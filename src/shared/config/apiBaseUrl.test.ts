import { describe, expect, it } from 'vitest';
import { resolveApiBaseUrl } from './apiBaseUrl';

describe('resolveApiBaseUrl', () => {
  it('usa la URL configurada del API Gateway', () => {
    expect(resolveApiBaseUrl('http://localhost:8080', 'http://localhost:3000')).toBe(
      'http://localhost:8080',
    );
  });

  it.each([undefined, '', '   '])('usa el mismo origen si la URL es %j', (configured) => {
    expect(resolveApiBaseUrl(configured, 'http://localhost:3000')).toBe('http://localhost:3000');
  });
});
