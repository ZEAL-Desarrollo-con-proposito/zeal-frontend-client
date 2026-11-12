import type { ReactNode } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '@/shared/api/errors';
import { configureHttpAuth } from '@/shared/api/httpClient';
import {
  renewSession,
  restoreSession,
  revokeSession,
  takeLoginInProgress,
} from '../api/sessionLifecycle';
import type { Session } from '../model/session';
import { forgetLegacySession, sessionStore } from '../storage/sessionStore';
import type { AuthContextValue } from './AuthContext';
import { AuthContext } from './AuthContext';

/** Límite de setTimeout (2^31 - 1 ms); un retraso mayor se dispararía de inmediato. */
const MAX_TIMER_DELAY_MS = 2_147_483_647;
/** Cuánto antes de vencer se renueva el token, para que ninguna petición llegue con uno vencido. */
export const RENEW_BEFORE_EXPIRY_MS = 30_000;
/** Si el servidor no responde, la sesión sigue y se vuelve a intentar: quizá solo cayó una réplica. */
export const RENEW_RETRY_MS = 30_000;
/** Canal por el que las pestañas se avisan que la sesión empezó o terminó (no lleva el token). */
export const SESSION_CHANNEL = 'zeal.sesion';

export type SessionEvent = { type: 'started' } | { type: 'ended'; expired: boolean };

/** El servidor respondió que no: la sesión ya no sirve. Un fallo suyo o de la red no dice nada. */
function isRejected(error: unknown): boolean {
  return error instanceof ApiError && error.status < 500;
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [session, setSession] = useState<Session | null>(() => sessionStore.load());
  const [restoring, setRestoring] = useState(() => sessionStore.load() === null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const channel = useRef<BroadcastChannel | null>(null);
  /** Cambia al terminar una sesión: una renovación que estaba en curso ya no la revive. */
  const sessionsEnded = useRef(0);

  const adopt = useCallback((next: Session) => {
    sessionStore.save(next);
    setSession(next);
    setSessionExpired(false);
  }, []);

  const finish = useCallback((expired: boolean) => {
    sessionsEnded.current += 1;
    sessionStore.clear();
    setSession(null);
    setSessionExpired(expired);
  }, []);

  const endSession = useCallback(
    (expired: boolean) => {
      finish(expired);
      channel.current?.postMessage({ type: 'ended', expired } satisfies SessionEvent);
    },
    [finish],
  );

  const signOut = useCallback(() => {
    void revokeSession();
    endSession(false);
  }, [endSession]);

  const renew = useCallback(async (): Promise<string | null> => {
    const startedDuring = sessionsEnded.current;
    try {
      const next = await renewSession();
      if (sessionsEnded.current !== startedDuring) {
        return null;
      }
      adopt(next);
      return next.accessToken;
    } catch (error) {
      if (isRejected(error)) {
        endSession(true);
      }
      return null;
    }
  }, [adopt, endSession]);

  useEffect(() => {
    forgetLegacySession();
  }, []);

  // Sin sesión en memoria (recarga, otra pestaña o el regreso de Microsoft): se recupera con la
  // cookie de refresh. Si la pestaña volvía de iniciar sesión, las demás la recuperan también.
  useEffect(() => {
    if (!restoring) {
      return;
    }
    void restoreSession().then((restored) => {
      const returningFromLogin = takeLoginInProgress();
      if (restored !== null) {
        adopt(restored);
        if (returningFromLogin) {
          channel.current?.postMessage({ type: 'started' } satisfies SessionEvent);
        }
      }
      setRestoring(false);
    });
  }, [restoring, adopt]);

  // Mientras hay sesión: autoriza las peticiones y renueva el token antes de que venza.
  // Layout effect: se registra antes de los efectos de las páginas hijas, que ya piden datos
  // con el token en su primer render.
  useLayoutEffect(() => {
    if (session === null) {
      return undefined;
    }
    configureHttpAuth({ accessToken: session.accessToken, renew });
    let timer: number;
    function keepAlive() {
      void renew().then((token) => {
        if (token === null) {
          timer = window.setTimeout(keepAlive, RENEW_RETRY_MS);
        }
      });
    }
    timer = window.setTimeout(
      keepAlive,
      Math.min(
        Math.max(session.expiresAt - Date.now() - RENEW_BEFORE_EXPIRY_MS, 0),
        MAX_TIMER_DELAY_MS,
      ),
    );
    return () => {
      configureHttpAuth(null);
      window.clearTimeout(timer);
    };
  }, [session, renew]);

  // Otra pestaña inició o cerró sesión: esta se sincroniza.
  useEffect(() => {
    const opened = new BroadcastChannel(SESSION_CHANNEL);
    channel.current = opened;
    opened.onmessage = ({ data }: MessageEvent<SessionEvent>) => {
      if (data.type === 'ended') {
        finish(data.expired);
      } else {
        renewSession().then(adopt, () => undefined);
      }
    };
    return () => {
      opened.close();
      channel.current = null;
    };
  }, [adopt, finish]);

  const value = useMemo<AuthContextValue>(
    () => ({ session, restoring, sessionExpired, signOut, renew }),
    [session, restoring, sessionExpired, signOut, renew],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
