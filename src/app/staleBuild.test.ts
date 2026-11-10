import { afterEach, describe, expect, it, vi } from 'vitest';
import { reloadOnStaleBuild, STALE_RELOAD_GUARD_MS, STALE_RELOAD_KEY } from './staleBuild';

const NOW = new Date(2026, 8, 23, 9, 20);

/** Página con almacenamiento real de jsdom (o uno que falla) y una recarga observable. */
function page(storage: Storage = sessionStorage) {
  const events = new EventTarget();
  const reload = vi.fn();
  reloadOnStaleBuild({
    addEventListener: (type, listener) => {
      events.addEventListener(type, listener);
    },
    sessionStorage: storage,
    location: { reload },
  });
  return {
    reload,
    /** El navegador no pudo descargar un paquete de sección; devuelve si se evitó el error. */
    failChunk: () => {
      const event = new Event('vite:preloadError', { cancelable: true });
      events.dispatchEvent(event);
      return event.defaultPrevented;
    },
  };
}

describe('pestaña con una versión anterior del frontend (HU-FE-19)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('recarga para traer la versión vigente', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const { reload, failChunk } = page();

    expect(failChunk()).toBe(true);

    expect(reload).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(STALE_RELOAD_KEY)).toBe(String(NOW.getTime()));
  });

  it('si recargó hace poco y vuelve a fallar, no insiste: deja ver el error', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const { reload, failChunk } = page();
    failChunk();

    vi.setSystemTime(NOW.getTime() + STALE_RELOAD_GUARD_MS - 1);
    expect(failChunk()).toBe(false);
    expect(reload).toHaveBeenCalledOnce();

    vi.setSystemTime(NOW.getTime() + STALE_RELOAD_GUARD_MS);
    expect(failChunk()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('sin almacenamiento (modo privado) no recarga, para no entrar en un ciclo', () => {
    const unavailable = {
      getItem: () => {
        throw new DOMException('Acceso denegado', 'SecurityError');
      },
    } as unknown as Storage;
    const { reload, failChunk } = page(unavailable);

    expect(failChunk()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
