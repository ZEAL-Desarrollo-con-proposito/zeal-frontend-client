import { describe, expect, it } from 'vitest';
import { pageNavigation } from './pageNavigation';

describe('pageNavigation', () => {
  it('navega con el navegador (jsdom solo permite cambiar el ancla)', () => {
    pageNavigation.assign('#contenido');

    expect(window.location.hash).toBe('#contenido');
  });
});
