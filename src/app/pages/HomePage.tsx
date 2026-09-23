import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { formatLongDate, getFirstName } from '@/shared/lib/text';
import styles from './HomePage.module.css';

/** Pantalla de llegada del rol. Su contenido (B1, C1, D1) llega con las historias de cada dominio. */
export function HomePage() {
  const user = useCurrentUser();

  return (
    <section className={styles.home} aria-labelledby="home-title">
      <h1 id="home-title" className={styles.title}>
        Hola, {getFirstName(user.fullName)}
      </h1>
      <p className={styles.date}>{formatLongDate(new Date())}</p>
    </section>
  );
}
