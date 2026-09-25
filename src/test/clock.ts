import { act } from '@testing-library/react';
import { vi } from 'vitest';
import { NOW_REFRESH_MS } from '@/shared/hooks/useNow';

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

/**
 * Como `freezeTime`, pero también controla los intervalos: permite simular el paso del tiempo
 * en pantallas que se refrescan solas (`useNow`). Los timeouts siguen reales.
 */
export function controlClock(now: Date = FIXED_NOW): void {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(now);
}

/** Lleva el reloj a `time` y deja pasar un refresco de `useNow` (queda 30 s después). */
export function jumpTo(time: Date): void {
  act(() => {
    vi.setSystemTime(time);
    vi.advanceTimersByTime(NOW_REFRESH_MS);
  });
}
