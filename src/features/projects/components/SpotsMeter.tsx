import { AnimatePresence, motion } from 'motion/react';
import type { Spots } from '../model/project';
import { availableSpots, spotsLabel } from '../model/project';
import styles from './SpotsMeter.module.css';

interface SpotsMeterProps {
  spots: Spots;
}

/**
 * Cupos de la convocatoria: barra de ocupación y cuántos quedan. Cuando cambian en vivo, la barra
 * se desliza y el texto entra de nuevo para que se note; el cambio se anuncia con cortesía.
 */
export function SpotsMeter({ spots }: Readonly<SpotsMeterProps>) {
  const full = availableSpots(spots) === 0;
  const occupation = full ? 1 : spots.occupied / spots.capacity;

  return (
    <div className={styles.meter} data-full={full}>
      <span className={styles.track} aria-hidden="true">
        <motion.span
          className={styles.fill}
          initial={false}
          animate={{ scaleX: occupation }}
          transition={{ type: 'spring', stiffness: 180, damping: 24 }}
        />
      </span>
      <p className={styles.label} aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={spots.version}
            className={styles.text}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {spotsLabel(spots)}
          </motion.span>
        </AnimatePresence>
      </p>
    </div>
  );
}
