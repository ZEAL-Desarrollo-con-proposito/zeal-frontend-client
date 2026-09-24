import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { HexIcon } from '@/shared/ui/HexIcon/HexIcon';
import styles from './StatusPage.module.css';

interface StatusPageProps {
  icon: string;
  code: string;
  title: string;
  description: string;
  action: ReactNode;
}

/** Plantilla de los estados del sistema (Figma sección F): sin barra lateral, mensaje y una salida clara. */
export function StatusPage({ icon, code, title, description, action }: Readonly<StatusPageProps>) {
  return (
    <main className={styles.page}>
      <motion.section
        className={styles.card}
        aria-labelledby="status-title"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <HexIcon src={icon} tone="soft" size="lg" />
        <p className={styles.code}>{code}</p>
        <h1 id="status-title" className={styles.title}>
          {title}
        </h1>
        <p className={styles.description}>{description}</p>
        {action}
      </motion.section>
    </main>
  );
}
