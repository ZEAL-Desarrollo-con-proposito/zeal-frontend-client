import { motion } from 'motion/react';
import { Navigate, useLocation } from 'react-router';
import { resolvePostLoginPath } from '@/app/paths';
import { LoginForm } from '../components/LoginForm';
import { LoginHero } from '../components/LoginHero';
import { useAuth } from '../hooks/useAuth';
import styles from './LoginPage.module.css';

export function LoginPage() {
  const { session, sessionExpired, signIn } = useAuth();
  const location = useLocation();

  // Con sesión activa (recién iniciada o restaurada) el login no aplica: se va al destino del rol.
  if (session !== null) {
    return <Navigate to={resolvePostLoginPath(session.user.role, location.state)} replace />;
  }

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
            Usa el correo corporativo de tu empresa. Tu organización solo ve métricas agregadas —
            nunca tu información individual.
          </p>
          {sessionExpired && (
            <p className={styles.expired} role="status">
              Tu sesión expiró por seguridad. Vuelve a iniciar sesión para continuar.
            </p>
          )}
          <LoginForm onAuthenticated={signIn} />
        </motion.div>
      </main>
    </div>
  );
}
