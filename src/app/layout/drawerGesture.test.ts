import { describe, expect, it } from 'vitest';
import { isDismissGesture } from './drawerGesture';

describe('isDismissGesture', () => {
  it.each([
    ['un arrastre largo a la izquierda', -120, -50, true],
    ['un deslizamiento rápido a la izquierda', -30, -800, true],
    ['un arrastre corto y lento', -40, -100, false],
    ['un arrastre hacia la derecha', 120, 300, false],
  ])('con %s devuelve %s', (_case, offsetX, velocityX, expected) => {
    expect(
      isDismissGesture({ offset: { x: offsetX, y: 0 }, velocity: { x: velocityX, y: 0 } }),
    ).toBe(expected);
  });
});
