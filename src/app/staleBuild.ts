/** Cuándo recargó esta pestaña por una versión anterior (no es un secreto). */
export const STALE_RELOAD_KEY = 'zeal.recarga.version';
/** Si recargar no lo resolvió en este lapso, el paquete de verdad no existe y no se insiste. */
export const STALE_RELOAD_GUARD_MS = 30_000;

/** Lo que se necesita de la página: escuchar el evento, recordar la recarga y recargar. */
interface Page {
  addEventListener: (type: string, listener: (event: Event) => void) => void;
  sessionStorage: Storage;
  location: { reload: () => void };
}

/** Última recarga registrada; `null` si el almacenamiento no está disponible (modo privado). */
function lastReload(storage: Storage): number | null {
  try {
    return Number(storage.getItem(STALE_RELOAD_KEY) ?? 0);
  } catch {
    return null;
  }
}

/**
 * Cada build cambia el nombre de los paquetes de sección (HU-FE-24). Tras un despliegue, o si el
 * balanceador alterna entre nodos con versiones distintas, una pestaña abierta con la versión
 * anterior pide paquetes que el servidor ya no tiene: se recarga para traer la vigente
 * (HU-FE-19, ADR-13). Si la misma pestaña recargó hace poco y vuelve a fallar, o no hay dónde
 * recordarlo, no recarga, para no entrar en un ciclo: se ve la pantalla de error.
 */
export function reloadOnStaleBuild(page: Page): void {
  page.addEventListener('vite:preloadError', (event) => {
    const last = lastReload(page.sessionStorage);
    const now = Date.now();
    if (last === null || now - last < STALE_RELOAD_GUARD_MS) {
      return;
    }
    page.sessionStorage.setItem(STALE_RELOAD_KEY, String(now));
    event.preventDefault();
    page.location.reload();
  });
}
