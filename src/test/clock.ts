import { vi } from 'vitest';

/** Miércoles 23 de septiembre de 2026, 9:20 a. m. (hora de Bogotá): una jornada laboral en curso. */
export const FIXED_NOW = new Date(2026, 8, 23, 9, 20);

/**
 * Congela solo el reloj (`Date`); los temporizadores siguen reales para no bloquear promesas,
 * MSW ni las interacciones de user-event.
 */
export function freezeTime(now: Date = FIXED_NOW): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
}
