import type { Session } from '../model/session';

/** Dónde guardaban la sesión las versiones anteriores, para borrarla de los navegadores. */
const LEGACY_SESSION_KEY = 'zeal.session';

let current: Session | null = null;

/**
 * La sesión vive solo en la memoria de la pestaña (HU-FE-21, escenario SEG-3): un script inyectado
 * no encuentra el token en localStorage ni en sessionStorage. Al recargar o abrir otra pestaña se
 * recupera con la cookie de refresh, que el navegador guarda fuera del alcance de JavaScript.
 */
export const sessionStore = {
  save: (session: Session): void => {
    current = session;
  },

  load: (now: number = Date.now()): Session | null =>
    current !== null && current.expiresAt > now ? current : null,

  /** Token vigente, aunque esté por vencer: la conexión en tiempo real lo pide al reconectarse. */
  accessToken: (): string | null => current?.accessToken ?? null,

  clear: (): void => {
    current = null;
  },
};

/** Borra el token que una versión anterior haya dejado guardado en el navegador. */
export function forgetLegacySession(): void {
  for (const storage of [sessionStorage, localStorage]) {
    try {
      storage.removeItem(LEGACY_SESSION_KEY);
    } catch {
      // Sin acceso al almacenamiento no hay nada que borrar.
    }
  }
}
