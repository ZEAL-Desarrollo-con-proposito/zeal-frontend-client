import { useId } from 'react';
import { motion } from 'motion/react';
import { Badge } from '@/shared/ui/Badge/Badge';
import { HexMark } from '@/shared/ui/HexMark/HexMark';
import { ClockIcon } from '@/shared/ui/icons';
import { useWorkshopSpots } from '../hooks/useWorkshopSpots';
import type { Workshop } from '../model/workshop';
import { availabilityOf, hasStarted, workshopWhen } from '../model/workshop';
import { EnrollAction } from './EnrollAction';
import { WorkshopSpots } from './WorkshopSpots';
import styles from './WorkshopCard.module.css';

export interface WorkshopItemProps {
  workshop: Workshop;
  now: number;
  enrolled: boolean;
  sending: boolean;
  onEnroll: (workshop: Workshop) => void;
}

interface WorkshopCardProps extends WorkshopItemProps {
  /** Posición en la grilla: escalona la entrada de las tarjetas. */
  index: number;
}

/** Figma B6 · tarjeta de un taller, con su disponibilidad y sus cupos al día. */
export function WorkshopCard({
  workshop,
  now,
  index,
  enrolled,
  sending,
  onEnroll,
}: Readonly<WorkshopCardProps>) {
  const spots = useWorkshopSpots(workshop.id, workshop);
  const availability = availabilityOf(spots);
  const titleId = useId();

  return (
    <motion.li
      className={styles.card}
      aria-labelledby={titleId}
      initial={{ opacity: 0, y: 16 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: { duration: 0.3, ease: 'easeOut', delay: Math.min(index, 6) * 0.06 },
      }}
      whileHover={{ y: -3, transition: { duration: 0.2, ease: 'easeOut' } }}
    >
      <div className={styles.top}>
        <HexMark subject={workshop} />
        <motion.span
          key={availability.label}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 480, damping: 26 }}
        >
          <Badge tone={availability.tone}>{availability.label}</Badge>
        </motion.span>
      </div>
      <h2 id={titleId} className={styles.title}>
        {workshop.title}
      </h2>
      <p className={styles.when}>
        <ClockIcon />
        {workshopWhen(workshop.startsAt, now)} · {workshop.facilitator}
      </p>
      <div className={styles.bottom}>
        <WorkshopSpots spots={spots} />
        <EnrollAction
          title={workshop.title}
          spots={spots}
          started={hasStarted(workshop, now)}
          enrolled={enrolled}
          sending={sending}
          onEnroll={() => {
            onEnroll(workshop);
          }}
        />
      </div>
    </motion.li>
  );
}
