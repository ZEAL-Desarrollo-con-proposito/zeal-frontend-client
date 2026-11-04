import { motion } from 'motion/react';
import styles from './SessionRestoring.module.css';

/**
 * Al recargar, la sesión se recupera con la cookie de refresh. Aparece con retraso: lo normal es
 * que la respuesta llegue antes de que alcance a verse.
 */
export function SessionRestoring() {
  return (
    <motion.p
      className={styles.restoring}
      role="status"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: 0.3 }}
    >
      Recuperando tu sesión…
    </motion.p>
  );
}
