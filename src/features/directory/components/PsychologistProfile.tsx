import { motion } from 'motion/react';
import { Avatar } from '@/shared/ui/Avatar/Avatar';
import { Badge } from '@/shared/ui/Badge/Badge';
import { ClockIcon } from '@/shared/ui/icons';
import type { Psychologist } from '../model/psychologist';
import { availabilityOf, avatarToneFor } from '../model/psychologist';
import styles from './PsychologistProfile.module.css';

interface PsychologistProfileProps {
  psychologist: Psychologist;
  now: number;
}

/** Figma B13 · Perfil: quién es, en qué temas acompaña y cuándo tiene el próximo espacio. */
export function PsychologistProfile({ psychologist, now }: Readonly<PsychologistProfileProps>) {
  const { id, fullName, title, focusAreas } = psychologist;
  const availability = availabilityOf(psychologist, now);

  return (
    <motion.header
      className={styles.profile}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <Avatar name={fullName} tone={avatarToneFor(id)} size="xl" />
      <div className={styles.details}>
        <div className={styles.nameRow}>
          <h1 className={styles.name}>{fullName}</h1>
          <motion.span
            key={availability.badge.label}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 26 }}
          >
            <Badge tone={availability.badge.tone}>{availability.badge.label}</Badge>
          </motion.span>
        </div>
        <p className={styles.title}>{title}</p>
        <ul className={styles.topics} aria-label="Temas que acompaña">
          {focusAreas.map((area) => (
            <li key={area}>
              <Badge tone="neutral">{area}</Badge>
            </li>
          ))}
        </ul>
        <p className={styles.next}>
          <ClockIcon />
          Próximo bloque libre: {availability.next}
        </p>
      </div>
    </motion.header>
  );
}
