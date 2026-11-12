import { useEffect, useState } from 'react';
import { NOW_REFRESH_MS, useNow } from '@/shared/hooks/useNow';
import { pageNavigation } from '@/shared/lib/pageNavigation';
import { startMicrosoftLogin } from '../api/authApi';
import { isLogoutPending, markLoginInProgress, revokeSession } from '../api/sessionLifecycle';
import { describeLoginError } from '../model/loginErrorMessage';
import { toLoginLockout, type LoginLockout } from '../model/loginLockout';

/** Mientras el origen está bloqueado, la cuenta atrás se refresca cada segundo. */
const LOCKOUT_TICK_MS = 1000;

/**
 * Inicio de sesión con Microsoft: pide al backend la dirección de autorización y navega allá. Al
 * volver, la sesión se recupera con la cookie de renovación que dejó el backend. Si el borde frenó
 * los intentos de este origen (SEG-1), espera lo que pide sin reintentar solo.
 */
export function useMicrosoftLogin(returnTo: string) {
  const [remember, setRemember] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockout, setLockout] = useState<LoginLockout | null>(null);

  const tick = useNow(lockout === null ? NOW_REFRESH_MS : LOCKOUT_TICK_MS);
  // `tick` puede venir del refresco anterior (hasta 30 s): el inicio del bloqueo lo corrige.
  const remainingMs =
    lockout === null ? 0 : Math.max(0, lockout.until - Math.max(tick, lockout.startedAt));
  const activeLockout =
    lockout !== null && remainingMs > 0 ? { until: lockout.until, remainingMs } : null;

  // Si la persona vuelve con "Atrás" desde Microsoft, el navegador puede restaurar la página
  // tal como quedó: el botón no debe seguir esperando.
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        setRedirecting(false);
      }
    }
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  async function start() {
    setRedirecting(true);
    setError(null);
    setLockout(null);
    try {
      // Un cierre de sesión que quedó pendiente se completa antes: si no, al volver se revocaría
      // la sesión nueva.
      if (isLogoutPending()) {
        await revokeSession();
      }
      const authorizationUrl = await startMicrosoftLogin({ remember, returnTo });
      markLoginInProgress();
      pageNavigation.assign(authorizationUrl);
    } catch (reason) {
      const blocked = toLoginLockout(reason);
      if (blocked === null) {
        setError(describeLoginError(reason));
      } else {
        setLockout(blocked);
      }
      setRedirecting(false);
    }
  }

  return { remember, setRemember, redirecting, error, lockout: activeLockout, start };
}
