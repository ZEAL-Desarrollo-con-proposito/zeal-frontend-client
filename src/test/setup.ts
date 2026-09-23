import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { afterEach } from 'vitest';

// Las animaciones terminan al instante: las pruebas verifican estados, no transiciones.
MotionGlobalConfig.skipAnimations = true;

// jsdom no implementa matchMedia; Motion lo consulta para respetar "reducir movimiento".
window.matchMedia = (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }) satisfies MediaQueryList;

afterEach(() => {
  cleanup();
});
