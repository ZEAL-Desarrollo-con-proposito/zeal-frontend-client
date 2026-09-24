import type { ReactNode } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { configureHttpAuth } from '@/shared/api/httpClient';
import type { Session } from '../model/session';
import { SESSION_STORAGE_KEY, sessionStore } from '../storage/sessionStore';
import type { AuthContextValue } from './AuthContext';
import { AuthContext } from './AuthContext';

/** Límite de setTimeout (2^31 - 1 ms); un retraso mayor se dispararía de inmediato. */
const MAX_TIMER_DELAY_MS = 2_147_483_647;

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [session, setSession] = useState<Session | null>(() => sessionStore.load());
  const [sessionExpired, setSessionExpired] = useState(false);

  const signIn = useCallback((next: Session, remember: boolean) => {
    sessionStore.save(next, remember);
    setSession(next);
    setSessionExpired(false);
  }, []);

  const endSession = useCallback((expired: boolean) => {
    sessionStore.clear();
    setSession(null);
    setSessionExpired(expired);
  }, []);

  const signOut = useCallback(() => {
    endSession(false);
  }, [endSession]);

  // Mientras hay sesión: autoriza las peticiones y la cierra cuando vence el token.
  // Layout effect: se registra antes de los efectos de las páginas hijas, que ya piden datos
  // con el token en su primer render.
  useLayoutEffect(() => {
    if (session === null) {
      return undefined;
    }
    const expire = () => {
      endSession(true);
    };
    configureHttpAuth({ accessToken: session.accessToken, onUnauthorized: expire });
    const timer = window.setTimeout(
      expire,
      Math.min(Math.max(session.expiresAt - Date.now(), 0), MAX_TIMER_DELAY_MS),
    );
    return () => {
      configureHttpAuth(null);
      window.clearTimeout(timer);
    };
  }, [session, endSession]);

  // Otra pestaña inició o cerró una sesión recordada: esta pestaña se sincroniza.
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SESSION_STORAGE_KEY || event.key === null) {
        setSession(sessionStore.load());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, sessionExpired, signIn, signOut }),
    [session, sessionExpired, signIn, signOut],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
