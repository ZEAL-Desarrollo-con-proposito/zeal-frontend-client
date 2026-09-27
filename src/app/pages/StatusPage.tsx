import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
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
  const titleRef = useRef<HTMLHeadingElement>(null);

  // El estado puede reemplazar la pantalla sin navegar (p. ej. un 403 al cargarla): el foco pasa
  // al título para que el lector de pantalla lo anuncie y el teclado siga desde aquí.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <main className={styles.page}>
      <motion.section
        className={styles.card}
        aria-labelledby="status-title"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <motion.span
          initial={{ opacity: 0, scale: 0.6, rotate: -12 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.15 }}
        >
          <HexIcon src={icon} tone="soft" size="lg" />
        </motion.span>
        <p className={styles.code}>{code}</p>
        <h1 id="status-title" ref={titleRef} tabIndex={-1} className={styles.title}>
          {title}
        </h1>
        <p className={styles.description}>{description}</p>
        {action}
      </motion.section>
    </main>
  );
}
