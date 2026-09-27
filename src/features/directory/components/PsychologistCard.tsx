import type { Ref } from 'react';
import { useId } from 'react';
import { motion } from 'motion/react';
import type { DirectoryReturnState } from '@/app/paths';
import { psychologistPath } from '@/app/paths';
import type { AvatarTone } from '@/shared/ui/Avatar/Avatar';
import { Avatar } from '@/shared/ui/Avatar/Avatar';
import { Badge } from '@/shared/ui/Badge/Badge';
import { LinkButton } from '@/shared/ui/Button/LinkButton';
import { ArrowRightIcon, ClockIcon } from '@/shared/ui/icons';
import type { Psychologist } from '../model/psychologist';
import { availabilityOf } from '../model/psychologist';
import styles from './PsychologistCard.module.css';

const AVATAR_TONES: Record<0 | 1 | 2, AvatarTone> = { 0: 'sage', 1: 'teal', 2: 'mauve' };

/** Color estable por persona: no cambia al filtrar ni al reordenar el directorio. */
function toneFor(id: string): AvatarTone {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash += id.charCodeAt(index);
  }
  return AVATAR_TONES[(hash % 3) as 0 | 1 | 2];
}

interface PsychologistCardProps {
  psychologist: Psychologist;
  now: number;
  /** Posición en la lista: escalona la entrada de las tarjetas. */
  index: number;
  returnState: DirectoryReturnState;
  ref?: Ref<HTMLLIElement>;
}

/** Figma B2 · tarjeta del directorio: quién es, en qué acompaña y cuándo tiene espacio. */
export function PsychologistCard({
  psychologist,
  now,
  index,
  returnState,
  ref,
}: Readonly<PsychologistCardProps>) {
  const { id, fullName, title, focusAreas } = psychologist;
  const availability = availabilityOf(psychologist, now);
  const nameId = useId();

  return (
    <motion.li
      ref={ref}
      layout
      className={styles.card}
      aria-labelledby={nameId}
      initial={{ opacity: 0, y: 16 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: { duration: 0.3, ease: 'easeOut', delay: Math.min(index, 6) * 0.05 },
      }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15, ease: 'easeIn' } }}
      whileHover={{ y: -4, transition: { duration: 0.2, ease: 'easeOut' } }}
      transition={{ layout: { duration: 0.3, ease: 'easeOut' } }}
    >
      <div className={styles.person}>
        <Avatar name={fullName} tone={toneFor(id)} size="lg" />
        <div className={styles.identity}>
          <h2 id={nameId} className={styles.name}>
            {fullName}
          </h2>
          <p className={styles.title}>{title}</p>
        </div>
      </div>

      <p className={styles.focus}>{focusAreas.join(' · ')}</p>

      <div className={styles.availability}>
        {/* Al cambiar la disponibilidad en vivo, la insignia "salta" para que se note. */}
        <motion.span
          key={availability.badge.label}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 520, damping: 26 }}
        >
          <Badge tone={availability.badge.tone}>{availability.badge.label}</Badge>
        </motion.span>
        <span className={styles.next}>
          <ClockIcon />
          <span className="visually-hidden">Próximo bloque libre:</span>
          {availability.next}
        </span>
      </div>

      <div className={styles.footer}>
        <LinkButton
          to={psychologistPath(id)}
          state={returnState}
          variant={availability.today ? 'primary' : 'outline'}
          className={styles.cta}
          aria-label={`Ver disponibilidad de ${fullName}`}
        >
          Ver disponibilidad
          <ArrowRightIcon />
        </LinkButton>
      </div>
    </motion.li>
  );
}
