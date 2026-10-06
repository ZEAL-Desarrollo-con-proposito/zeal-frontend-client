import { AnimatePresence, motion } from 'motion/react';
import type { Spots } from '@/shared/spots/spots';
import { availabilityOf, occupancy, spotsCount } from '../model/workshop';
import styles from './WorkshopSpots.module.css';

interface WorkshopSpotsProps {
  spots: Spots;
  /** `hero`: el taller destacado, con la cifra grande y sin porcentaje (Figma B6). */
  size?: 'card' | 'hero';
}

/**
 * Cupos del taller: "29 / 30 cupos", porcentaje y barra con el color de su disponibilidad. Cuando
 * cambian en vivo, la barra se desliza y la cifra entra de nuevo; el cambio se anuncia con cortesía.
 */
export function WorkshopSpots({ spots, size = 'card' }: Readonly<WorkshopSpotsProps>) {
  const percent = occupancy(spots);

  return (
    <div className={styles.spots} data-tone={availabilityOf(spots).tone} data-size={size}>
      <p className={styles.row}>
        <span className={styles.count} aria-live="polite">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={spots.version}
              className={styles.text}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              {spotsCount(spots)}
            </motion.span>
          </AnimatePresence>
        </span>
        {size === 'card' && (
          <span className={styles.percent} aria-hidden="true">
            {percent}%
          </span>
        )}
      </p>
      <span className={styles.track} aria-hidden="true">
        <motion.span
          className={styles.fill}
          initial={false}
          animate={{ scaleX: percent / 100 }}
          transition={{ type: 'spring', stiffness: 180, damping: 24 }}
        />
      </span>
    </div>
  );
}
