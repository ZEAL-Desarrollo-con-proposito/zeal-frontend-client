import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from '@/mocks/server';

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

// Las pruebas usan el mismo API simulado que el entorno de desarrollo.
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
