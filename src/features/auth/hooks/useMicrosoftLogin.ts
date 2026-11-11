import { useEffect, useState } from 'react';
import { pageNavigation } from '@/shared/lib/pageNavigation';
import { startMicrosoftLogin } from '../api/authApi';
import { isLogoutPending, markLoginInProgress, revokeSession } from '../api/sessionLifecycle';
import { describeLoginError } from '../model/loginErrorMessage';

/**
 * Inicio de sesión con Microsoft: pide al backend la dirección de autorización y navega allá. Al
 * volver, la sesión se recupera con la cookie de renovación que dejó el backend.
 */
export function useMicrosoftLogin(returnTo: string) {
  const [remember, setRemember] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(describeLoginError(reason));
      setRedirecting(false);
    }
  }

  return { remember, setRemember, redirecting, error, start };
}
