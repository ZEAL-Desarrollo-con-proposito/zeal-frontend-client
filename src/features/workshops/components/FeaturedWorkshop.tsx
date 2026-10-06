import { useId } from 'react';
import { motion } from 'motion/react';
import { Badge } from '@/shared/ui/Badge/Badge';
import { HexMark } from '@/shared/ui/HexMark/HexMark';
import { useWorkshopSpots } from '../hooks/useWorkshopSpots';
import { hasStarted, startBadge, workshopWhen } from '../model/workshop';
import type { WorkshopItemProps } from './WorkshopCard';
import { EnrollAction } from './EnrollAction';
import { WorkshopSpots } from './WorkshopSpots';
import styles from './FeaturedWorkshop.module.css';

/** Figma B6 · el taller destacado sobre teal: cuándo empieza, de qué se trata y sus cupos. */
export function FeaturedWorkshop({
  workshop,
  now,
  enrolled,
  sending,
  onEnroll,
}: Readonly<WorkshopItemProps>) {
  const spots = useWorkshopSpots(workshop.id, workshop);
  const start = startBadge(workshop, now);
  const titleId = useId();

  return (
    <motion.article
      className={styles.hero}
      aria-labelledby={titleId}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <HexMark subject={workshop} size="lg" />
      <div className={styles.body}>
        <p className={styles.meta}>
          {start !== null && <Badge tone={start.tone}>{start.label}</Badge>}
          <span>{workshopWhen(workshop, now)}</span>
        </p>
        <h2 id={titleId} className={styles.title}>
          {workshop.title}
        </h2>
        <p className={styles.summary}>{workshop.description}</p>
      </div>
      <div className={styles.side}>
        <WorkshopSpots spots={spots} size="hero" />
        <EnrollAction
          title={workshop.title}
          spots={spots}
          started={hasStarted(workshop, now)}
          enrolled={enrolled}
          sending={sending}
          surface="dark"
          onEnroll={() => {
            onEnroll(workshop);
          }}
        />
      </div>
    </motion.article>
  );
}
