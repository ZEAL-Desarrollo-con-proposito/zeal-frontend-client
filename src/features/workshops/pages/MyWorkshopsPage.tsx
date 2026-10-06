import { useId } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router';
import { EMPLOYEE_PATHS } from '@/app/paths';
import { useNow } from '@/shared/hooks/useNow';
import { Badge } from '@/shared/ui/Badge/Badge';
import { Button } from '@/shared/ui/Button/Button';
import { LinkButton } from '@/shared/ui/Button/LinkButton';
import { HexMark } from '@/shared/ui/HexMark/HexMark';
import { ArrowLeftIcon, ClockIcon } from '@/shared/ui/icons';
import { useEnrollments } from '../hooks/useEnrollments';
import type { Enrollment } from '../model/enrollment';
import { startBadge, workshopDuration, workshopWhen } from '../model/workshop';
import styles from './MyWorkshopsPage.module.css';

/** Sin chip de inicio (falta más de una hora), se confirma que el cupo es de la persona. */
const ENROLLED_BADGE = { label: 'Tienes tu cupo', tone: 'sage' } as const;

function EnrollmentItem({ enrollment, now }: Readonly<{ enrollment: Enrollment; now: number }>) {
  const titleId = useId();
  const badge = startBadge(enrollment, now) ?? ENROLLED_BADGE;

  return (
    <motion.li
      layout
      className={styles.item}
      aria-labelledby={titleId}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <HexMark subject={{ id: enrollment.workshopId, title: enrollment.workshopTitle }} />
      <div className={styles.body}>
        <h2 id={titleId} className={styles.itemTitle}>
          {enrollment.workshopTitle}
        </h2>
        <p className={styles.when}>
          <ClockIcon />
          {workshopWhen(enrollment.startsAt, now)} · {workshopDuration(enrollment)} ·{' '}
          {enrollment.facilitator}
        </p>
      </div>
      <Badge tone={badge.tone}>{badge.label}</Badge>
    </motion.li>
  );
}

/**
 * Mis talleres (HU-FE-18): los talleres donde la persona tiene su cupo, del más próximo al más
 * lejano. Se mantiene al día en vivo (una inscripción en otra pestaña aparece al instante).
 */
export function MyWorkshopsPage() {
  const now = useNow();
  const { status, enrollments, reload } = useEnrollments();

  function content() {
    if (enrollments.length > 0) {
      return (
        <ul className={styles.list}>
          <AnimatePresence initial={false}>
            {enrollments.map((enrollment) => (
              <EnrollmentItem key={enrollment.id} enrollment={enrollment} now={now} />
            ))}
          </AnimatePresence>
        </ul>
      );
    }
    if (status === 'error') {
      return (
        <div className={styles.feedback} role="alert">
          <p>No pudimos cargar tus talleres.</p>
          <Button variant="outline" onClick={reload}>
            Reintentar
          </Button>
        </div>
      );
    }
    if (status === 'loading') {
      return (
        <p className={styles.feedback} aria-busy="true">
          Cargando tus talleres…
        </p>
      );
    }
    return (
      <div className={styles.feedback}>
        <h2 className={styles.feedbackTitle}>Aún no te has inscrito a ningún taller</h2>
        <p>Elige uno y toma tu cupo antes de que se agote.</p>
        <LinkButton to={EMPLOYEE_PATHS.workshops}>Ver talleres</LinkButton>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <motion.header
        className={styles.head}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <Link to={EMPLOYEE_PATHS.workshops} className={styles.back}>
          <ArrowLeftIcon />
          Talleres comunitarios
        </Link>
        <h1 className={styles.title}>Mis talleres</h1>
        <p className={styles.subtitle}>
          Los talleres donde ya tienes tu cupo, del más próximo al más lejano.
        </p>
      </motion.header>
      <section aria-label="Tus inscripciones">{content()}</section>
    </div>
  );
}
