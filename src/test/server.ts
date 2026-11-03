import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';
import { server } from '@/mocks/server';

/**
 * Fija el azar de la espera entre reintentos del cliente HTTP: cada espera dura `fraction` de su
 * tope (0 = reintenta sin esperar).
 */
export function fixRetryJitter(fraction: number): void {
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(
    <T extends ArrayBufferView | null>(array: T): T => {
      if (array instanceof Uint32Array) {
        array.fill(Math.floor(fraction * 2 ** 32));
      }
      return array;
    },
  );
}

/**
 * Deja las consultas a `endpoint` sin servidor, como en una caída real: los reintentos
 * automáticos del cliente también fallan (sin espera entre ellos, para no alargar la prueba).
 * Devuelve la función que vuelve a levantarlo; desde ahí responde el API simulado.
 */
export function takeDown(endpoint: string): () => void {
  fixRetryJitter(0);
  let down = true;
  server.use(http.get(`*${endpoint}`, () => (down ? HttpResponse.error() : undefined)));
  return () => {
    down = false;
  };
}
