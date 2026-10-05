import { motion } from 'motion/react';
import { useNow } from '@/shared/hooks/useNow';
import { Button } from '@/shared/ui/Button/Button';
import { ShieldIcon } from '@/shared/ui/icons';
import { MY_APPLICATIONS_ID, MyApplications } from '../components/MyApplications';
import { ProjectCard } from '../components/ProjectCard';
import { useApplications } from '../hooks/useApplications';
import { useProjects } from '../hooks/useProjects';
import styles from './ProjectsPage.module.css';

const PLACEHOLDERS = ['uno', 'dos', 'tres'] as const;

/**
 * Figma B8 · Convocatorias internas: proyectos con cupos que cambian en vivo (HU-FE-16) y la
 * postulación con su resultado y Mis postulaciones (HU-FE-17).
 */
export function ProjectsPage() {
  const now = useNow();
  const { status, projects, reload } = useProjects();
  const applications = useApplications();
  const loaded = projects.length > 0;

  return (
    <div className={styles.page}>
      <motion.header
        className={styles.head}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <div className={styles.headText}>
          <h1 className={styles.title}>Convocatorias internas</h1>
          <p className={styles.subtitle}>
            Cupos limitados por proyecto. Cuando el cupo se agota, la postulación se cierra al
            instante para todos.
          </p>
        </div>
        <a href={`#${MY_APPLICATIONS_ID}`} className={styles.myApplications}>
          Mis postulaciones
        </a>
      </motion.header>

      <div className={styles.layout}>
        <section
          className={styles.list}
          aria-label="Convocatorias abiertas"
          aria-busy={status === 'loading'}
        >
          {status === 'error' && (
            <div className={styles.feedback} role="alert">
              <p>No pudimos cargar las convocatorias.</p>
              <Button variant="outline" onClick={reload}>
                Reintentar
              </Button>
            </div>
          )}
          {status === 'loading' && !loaded && (
            <ul className={styles.cards} aria-hidden="true">
              {PLACEHOLDERS.map((placeholder) => (
                <li key={placeholder} className={styles.placeholder} />
              ))}
            </ul>
          )}
          {status === 'ready' && !loaded && (
            <div className={styles.feedback}>
              <h2 className={styles.feedbackTitle}>No hay convocatorias abiertas</h2>
              <p>Cuando tu empresa publique un proyecto con cupos, aparecerá aquí al instante.</p>
            </div>
          )}
          {loaded && (
            <ul className={styles.cards}>
              {projects.map((project, index) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  now={now}
                  index={index}
                  application={applications.applicationFor(project.id)}
                  sending={applications.isSending(project.id)}
                  onApply={(projectId) => void applications.apply(projectId)}
                />
              ))}
            </ul>
          )}
        </section>

        <div className={styles.side}>
          <MyApplications
            status={applications.status}
            applications={applications.applications}
            onRetry={applications.reload}
          />
          <aside className={styles.note} aria-labelledby="sin-sobreasignacion">
            <h2 id="sin-sobreasignacion" className={styles.noteTitle}>
              <ShieldIcon />
              Sin sobreasignación
            </h2>
            <p>
              Muchas personas pueden postularse en el mismo segundo: cada cupo se asigna una sola
              vez y el resto queda en lista de espera con una respuesta clara, nunca un cupo
              fantasma.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
