import type { Session } from '../model/session';
import { isSession } from '../model/session';

export const SESSION_STORAGE_KEY = 'zeal.session';

/**
 * Persistencia de la sesión en el navegador.
 * - Sin "Recordarme": sessionStorage (se borra al cerrar la pestaña).
 * - Con "Recordarme": localStorage (sobrevive al cierre y se comparte entre pestañas).
 * Lo leído se valida antes de usarse: el almacenamiento puede estar alterado o vencido.
 */
export const sessionStore = {
  save(session: Session, remember: boolean): void {
    this.clear();
    try {
      const storage = remember ? localStorage : sessionStorage;
      storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Almacenamiento bloqueado o lleno: la sesión sigue viva en memoria para esta pestaña.
    }
  },

  load(now: number = Date.now()): Session | null {
    for (const storage of [sessionStorage, localStorage]) {
      const session = readValidSession(storage, now);
      if (session !== null) {
        return session;
      }
    }
    return null;
  },

  clear(): void {
    for (const storage of [sessionStorage, localStorage]) {
      try {
        storage.removeItem(SESSION_STORAGE_KEY);
      } catch {
        // Sin acceso al almacenamiento no hay nada que borrar.
      }
    }
  },
};

function readValidSession(storage: Storage, now: number): Session | null {
  try {
    const raw = storage.getItem(SESSION_STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    const candidate: unknown = JSON.parse(raw);
    if (isSession(candidate) && candidate.expiresAt > now) {
      return candidate;
    }
    storage.removeItem(SESSION_STORAGE_KEY);
    return null;
  } catch {
    return null;
  }
}
