import { motion } from 'motion/react';
import { Navigate, useLocation, useSearchParams } from 'react-router';
import { PATHS, resolvePostLoginPath } from '@/app/paths';
import { LoginForm } from '../components/LoginForm';
import { LoginHero } from '../components/LoginHero';
import { useAuth } from '../hooks/useAuth';
import { describeReturnError } from '../model/loginErrorMessage';
import { isRecord } from '../model/session';
import styles from './LoginPage.module.css';

/** Parámetro con la pantalla que se quería abrir: sobrevive al viaje de ida y vuelta a Microsoft. */
export const RETURN_PARAM = 'desde';

/** La pantalla protegida que mandó al login, si la hay. */
function requestedPath(state: unknown, params: URLSearchParams): string | null {
  const fromState = isRecord(state) && typeof state.from === 'string' ? state.from : null;
  return fromState ?? params.get(RETURN_PARAM);
}

export function LoginPage() {
  const { session, sessionExpired } = useAuth();
  const location = useLocation();
  const [params] = useSearchParams();
  const from = requestedPath(location.state, params);

  // Con sesión activa (recuperada al volver de Microsoft o ya en memoria) se va al destino del
  // rol: la pantalla pedida solo si es de ese rol.
  if (session !== null) {
    return <Navigate to={resolvePostLoginPath(session.user.role, { from })} replace />;
  }

  const returnTo =
    from === null ? PATHS.login : `${PATHS.login}?${RETURN_PARAM}=${encodeURIComponent(from)}`;

  return (
    <div className={styles.page}>
      <LoginHero />
      <main className={styles.panel}>
        <motion.div
          className={styles.content}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
        >
          <h1 className={styles.title}>Ingresa a ZEAL</h1>
          <p className={styles.intro}>
            Usa la cuenta de Microsoft (Outlook o Microsoft 365) de tu empresa. Tu organización solo
            ve métricas agregadas — nunca tu información individual.
          </p>
          {sessionExpired && (
            <p className={styles.expired} role="status">
              Tu sesión expiró por seguridad. Vuelve a iniciar sesión para continuar.
            </p>
          )}
          <LoginForm returnTo={returnTo} returnError={describeReturnError(params.get('error'))} />
        </motion.div>
      </main>
    </div>
  );
}
