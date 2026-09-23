import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { ROLE_HOME_PATH } from '@/app/paths';
import { LoginForm } from '../components/LoginForm';
import { LoginHero } from '../components/LoginHero';
import { useAuth } from '../hooks/useAuth';
import type { Session } from '../model/session';
import styles from './LoginPage.module.css';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  function handleAuthenticated(session: Session) {
    signIn(session);
    void navigate(ROLE_HOME_PATH[session.user.role], { replace: true });
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
          <LoginForm onAuthenticated={handleAuthenticated} />
        </motion.div>
      </main>
    </div>
  );
}
