import { useId } from 'react';
import { motion } from 'motion/react';
import { workshopRoomPath } from '@/app/paths';
import { isRoomWindow } from '@/features/workshopRoom/model/workshopRoom';
import { Badge } from '@/shared/ui/Badge/Badge';
import { LinkButton } from '@/shared/ui/Button/LinkButton';
import type { Workshop } from '../model/workshop';
import { capacityLabel, describeSchedule, hasStarted } from '../model/workshop';
import styles from './AdminWorkshopList.module.css';

interface AdminWorkshopListProps {
  workshops: readonly Workshop[];
  now: number;
}

/** Talleres publicados: estado, horario y capacidad. */
export function AdminWorkshopList({ workshops, now }: Readonly<AdminWorkshopListProps>) {
  return (
    <ul className={styles.list} aria-label="Talleres publicados">
      {workshops.map((workshop, index) => (
        <AdminWorkshopCard key={workshop.id} workshop={workshop} now={now} index={index} />
      ))}
    </ul>
  );
}

interface AdminWorkshopCardProps {
  workshop: Workshop;
  now: number;
  index: number;
}

function AdminWorkshopCard({ workshop, now, index }: Readonly<AdminWorkshopCardProps>) {
  const titleId = useId();
  const started = hasStarted(workshop, now);
  const full = workshop.occupied >= workshop.capacity;

  let badge: { label: string; tone: 'neutral' | 'coral' | 'sage' } = {
    label: 'Abierto',
    tone: 'sage',
  };
  if (started) {
    badge = { label: 'Realizado', tone: 'neutral' };
  } else if (full) {
    badge = { label: 'Sin cupos', tone: 'coral' };
  }

  return (
    <motion.li
      className={styles.card}
      aria-labelledby={titleId}
      data-started={started}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut', delay: Math.min(index, 6) * 0.04 }}
    >
      <div className={styles.head}>
        <h3 id={titleId} className={styles.name}>
          {workshop.title}
        </h3>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>
      <p className={styles.meta}>{describeSchedule(workshop)}</p>
      <p className={styles.description}>{workshop.description}</p>
      <p className={styles.capacity}>
        {capacityLabel(workshop.capacity)} · {workshop.occupied} inscritas
      </p>
      {isRoomWindow(workshop, now) && (
        <LinkButton
          to={workshopRoomPath('ADMIN', workshop.id)}
          className={styles.roomLink}
          aria-label={`Abrir la sala de ${workshop.title}`}
        >
          Abrir la sala del taller
        </LinkButton>
      )}
    </motion.li>
  );
}
