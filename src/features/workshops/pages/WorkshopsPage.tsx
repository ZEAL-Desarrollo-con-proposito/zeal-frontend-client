import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router';
import { EMPLOYEE_PATHS } from '@/app/paths';
import { useNow } from '@/shared/hooks/useNow';
import { Button } from '@/shared/ui/Button/Button';
import { EnrollDialog } from '../components/EnrollDialog';
import { FeaturedWorkshop } from '../components/FeaturedWorkshop';
import { WorkshopCard } from '../components/WorkshopCard';
import { useEnrollments } from '../hooks/useEnrollments';
import { useWorkshops } from '../hooks/useWorkshops';
import type { Workshop } from '../model/workshop';
import styles from './WorkshopsPage.module.css';

const PLACEHOLDERS = ['uno', 'dos', 'tres'] as const;

/**
 * Figma B6 · Talleres comunitarios (HU-FE-18): el próximo taller destacado y el resto en grilla,
 * con cupos que cambian en vivo. Inscribirse pide confirmación y el servidor asigna el cupo de
 * forma atómica: si se agotó, el motivo se muestra y no hay sobreasignación.
 */
export function WorkshopsPage() {
  const now = useNow();
  const { status, data, reload } = useWorkshops();
  const enrollments = useEnrollments();
  const [selected, setSelected] = useState<Workshop | null>(null);
  const [featured, ...rest] = data ?? [];

  function itemProps(workshop: Workshop) {
    return {
      workshop,
      now,
      enrolled: enrollments.enrollmentFor(workshop.id) !== null,
      sending: enrollments.isEnrolling(workshop.id),
      onEnroll: setSelected,
    };
  }

  return (
    <div className={styles.page}>
      <motion.header
        className={styles.head}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <div className={styles.headText}>
          <h1 className={styles.title}>Talleres comunitarios</h1>
          <p className={styles.subtitle}>
            Cupos estrictamente limitados: la inscripción se resuelve de forma atómica, sin
            sobreasignación.
          </p>
        </div>
        <Link to={EMPLOYEE_PATHS.myWorkshops} className={styles.mine}>
          Mis talleres
        </Link>
      </motion.header>

      <section
        className={styles.catalog}
        aria-label="Talleres próximos"
        aria-busy={status === 'loading'}
      >
        {status === 'error' && (
          <div className={styles.feedback} role="alert">
            <p>No pudimos cargar los talleres.</p>
            <Button variant="outline" onClick={reload}>
              Reintentar
            </Button>
          </div>
        )}
        {status === 'loading' && featured === undefined && (
          <ul className={styles.grid} aria-hidden="true">
            {PLACEHOLDERS.map((placeholder) => (
              <li key={placeholder} className={styles.placeholder} />
            ))}
          </ul>
        )}
        {status === 'ready' && featured === undefined && (
          <div className={styles.feedback}>
            <h2 className={styles.feedbackTitle}>No hay talleres próximos</h2>
            <p>Cuando tu empresa programe un taller, aparecerá aquí con sus cupos.</p>
          </div>
        )}
        {featured !== undefined && <FeaturedWorkshop {...itemProps(featured)} />}
        {rest.length > 0 && (
          <ul className={styles.grid}>
            {rest.map((workshop, index) => (
              <WorkshopCard key={workshop.id} index={index} {...itemProps(workshop)} />
            ))}
          </ul>
        )}
      </section>

      <AnimatePresence>
        {selected !== null && (
          <EnrollDialog
            key={selected.id}
            workshop={selected}
            now={now}
            pending={enrollments.isEnrolling(selected.id)}
            onEnroll={enrollments.enroll}
            onClose={() => {
              setSelected(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
