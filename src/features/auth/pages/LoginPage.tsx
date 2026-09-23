import { LoginHero } from '../components/LoginHero';
import styles from './LoginPage.module.css';

export function LoginPage() {
  return (
    <div className={styles.page}>
      <LoginHero />
      <main className={styles.panel}>
        <div className={styles.content}>
          <h1 className={styles.title}>Ingresa a ZEAL</h1>
          <p className={styles.intro}>
            Usa el correo corporativo de tu empresa. Tu organización solo ve métricas agregadas —
            nunca tu información individual.
          </p>
        </div>
      </main>
    </div>
  );
}
