import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from '@/mocks/server';
import { fakeMediaQueryList } from './media';

// La suite corre un proceso por archivo en paralelo; con la CPU ocupada, el primer render de una
// página completa puede pasar de 1 s (el valor por defecto de findBy/waitFor).
configure({ asyncUtilTimeout: 3000 });

// Las animaciones terminan al instante: las pruebas verifican estados, no transiciones.
MotionGlobalConfig.skipAnimations = true;

// jsdom no implementa matchMedia; Motion lo consulta para respetar "reducir movimiento".
window.matchMedia = (query: string) => fakeMediaQueryList(query);

// jsdom tampoco implementa scrollIntoView (se usa para acercar el resumen de la reserva).
Element.prototype.scrollIntoView = () => undefined;

// Las pruebas usan el mismo API simulado que el entorno de desarrollo.
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  server.resetHandlers();
  localStorage.clear();
  sessionStorage.clear();
});

afterAll(() => {
  server.close();
});
