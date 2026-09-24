import { motion } from 'motion/react';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { LinkButton } from '@/shared/ui/Button/LinkButton';
import { HexIcon } from '@/shared/ui/HexIcon/HexIcon';
import type { NavItem } from '../navigation';
import { ROLE_HOME_PATH } from '../paths';
import styles from './SectionPage.module.css';

interface SectionPageProps {
  section: NavItem;
}

/**
 * Sección del menú cuya pantalla llega con su propia historia de usuario. En lugar de una
 * pantalla en blanco muestra qué contendrá y una salida (estado vacío, Figma sección F).
 */
export function SectionPage({ section }: Readonly<SectionPageProps>) {
  const user = useCurrentUser();

  return (
    <section className={styles.section} aria-labelledby="section-title">
      <h1 id="section-title" className={styles.title}>
        {section.label}
      </h1>
      <motion.div
        className={styles.empty}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <HexIcon src={section.icon} size="lg" />
        <p className={styles.badge}>En construcción</p>
        <p className={styles.description}>{section.description}</p>
        <p className={styles.hint}>Esta sección se habilita con su historia de usuario.</p>
        <LinkButton to={ROLE_HOME_PATH[user.role]} variant="outline">
          Volver al inicio
        </LinkButton>
      </motion.div>
    </section>
  );
}
