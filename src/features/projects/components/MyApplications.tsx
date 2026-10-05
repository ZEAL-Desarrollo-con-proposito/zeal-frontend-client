import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router';
import { projectPath } from '@/app/paths';
import type { LoadStatus } from '@/shared/hooks/useFetch';
import { Badge } from '@/shared/ui/Badge/Badge';
import { Button } from '@/shared/ui/Button/Button';
import type { Application } from '../model/application';
import { applicationBadge } from '../model/application';
import styles from './MyApplications.module.css';

export const MY_APPLICATIONS_ID = 'mis-postulaciones';

interface MyApplicationsProps {
  status: LoadStatus;
  applications: Application[];
  onRetry: () => void;
}

/** Figma B8 · Mis postulaciones: cada convocatoria con su resultado, al día en vivo. */
export function MyApplications({ status, applications, onRetry }: Readonly<MyApplicationsProps>) {
  function content() {
    if (applications.length > 0) {
      return (
        <ul className={styles.list}>
          <AnimatePresence initial={false}>
            {applications.map((application) => {
              const badge = applicationBadge(application);
              return (
                <motion.li
                  key={application.id}
                  layout
                  className={styles.item}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                  <Link to={projectPath(application.projectId)} className={styles.project}>
                    {application.projectTitle}
                  </Link>
                  <motion.span
                    key={badge.label}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 480, damping: 26 }}
                  >
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </motion.span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      );
    }
    if (status === 'error') {
      return (
        <div className={styles.feedback} role="alert">
          <p>No pudimos cargar tus postulaciones.</p>
          <Button variant="outline" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      );
    }
    if (status === 'loading') {
      return (
        <p className={styles.feedback} aria-busy="true">
          Cargando tus postulaciones…
        </p>
      );
    }
    return (
      <p className={styles.feedback}>
        Aún no te has postulado. Elige una convocatoria y toma tu cupo antes de que se agote.
      </p>
    );
  }

  return (
    <section
      id={MY_APPLICATIONS_ID}
      className={styles.panel}
      aria-labelledby="mis-postulaciones-titulo"
    >
      <h2 id="mis-postulaciones-titulo" className={styles.title}>
        Mis postulaciones
      </h2>
      {content()}
    </section>
  );
}
