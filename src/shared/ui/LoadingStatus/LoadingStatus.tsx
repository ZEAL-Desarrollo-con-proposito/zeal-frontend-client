import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import styles from './LoadingStatus.module.css';

interface LoadingStatusProps {
  children: ReactNode;
  /** Ocupa toda la ventana: no hay estructura de la aplicación alrededor. */
  fullScreen?: boolean;
}

/**
 * Aviso de espera, anunciado a los lectores de pantalla. Aparece con retraso: lo normal es que la
 * espera termine antes de que alcance a verse, y así la pantalla no parpadea.
 */
export function LoadingStatus({ children, fullScreen = false }: Readonly<LoadingStatusProps>) {
  return (
    <motion.p
      className={fullScreen ? `${styles.status} ${styles.fullScreen}` : styles.status}
      role="status"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: 0.3 }}
    >
      {children}
    </motion.p>
  );
}
