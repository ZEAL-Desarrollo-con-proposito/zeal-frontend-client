import { motion } from 'motion/react';
import { Link, useParams } from 'react-router';
import { EMPLOYEE_PATHS } from '@/app/paths';
import { ApiError } from '@/shared/api/errors';
import { useNow } from '@/shared/hooks/useNow';
import { Button } from '@/shared/ui/Button/Button';
import { LinkButton } from '@/shared/ui/Button/LinkButton';
import { CheckIcon, ChevronLeftIcon, LockIcon, TrendIcon } from '@/shared/ui/icons';
import { ApplyButton } from '../components/ApplyButton';
import { ClosingChip } from '../components/ClosingChip';
import { ProjectMark } from '../components/ProjectMark';
import { SpotsMeter } from '../components/SpotsMeter';
import { useLiveSpots } from '../hooks/useLiveSpots';
import { useProject } from '../hooks/useProjects';
import type { ProjectDetail } from '../model/project';
import { closingOf } from '../model/project';
import styles from './ProjectDetailPage.module.css';

/** Figma B11 · Detalle de una convocatoria, con sus cupos al día (HU-FE-16). */
export function ProjectDetailPage() {
  const { projectId = '' } = useParams();
  const now = useNow();
  const project = useProject(projectId);

  if (project.error instanceof ApiError && project.error.status === 404) {
    return (
      <div className={styles.notFound}>
        <h1 className={styles.notFoundTitle}>No encontramos esta convocatoria</h1>
        <p>Puede que ya no esté publicada.</p>
        <LinkButton to={EMPLOYEE_PATHS.projects} variant="outline">
          Ver convocatorias
        </LinkButton>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Ruta de navegación">
        <Link to={EMPLOYEE_PATHS.projects} className={styles.backLink}>
          <ChevronLeftIcon />
          Convocatorias internas
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{project.data?.title ?? 'Convocatoria'}</span>
      </nav>

      {project.status === 'error' && (
        <div className={styles.feedback} role="alert">
          <p>No pudimos cargar la convocatoria.</p>
          <Button variant="outline" onClick={project.reload}>
            Reintentar
          </Button>
        </div>
      )}
      {project.data === null ? (
        project.status === 'loading' && <div className={styles.skeleton} aria-hidden="true" />
      ) : (
        <ProjectView key={project.data.id} project={project.data} now={now} />
      )}
    </div>
  );
}

interface ProjectViewProps {
  project: ProjectDetail;
  now: number;
}

function ProjectView({ project, now }: Readonly<ProjectViewProps>) {
  const spots = useLiveSpots(project.id, project);
  const closing = closingOf(project.closesAt, now);

  return (
    <motion.div
      className={styles.view}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <header className={styles.head}>
        <div className={styles.headText}>
          <p className={styles.tags}>
            <ClosingChip closing={closing} />
            <span className={styles.meta}>
              {project.area} · {project.cohort}
            </span>
          </p>
          <h1 className={styles.title}>{project.title}</h1>
        </div>
        <ProjectMark project={project} size="lg" />
      </header>

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.card} aria-labelledby="de-que-se-trata">
            <h2 id="de-que-se-trata" className={styles.sectionTitle}>
              De qué se trata
            </h2>
            {project.description.map((paragraph) => (
              <p key={paragraph} className={styles.paragraph}>
                {paragraph}
              </p>
            ))}
            <h2 className={styles.sectionTitle}>Qué necesitas traer</h2>
            <ul className={styles.requirements}>
              {project.requirements.map((requirement) => (
                <li key={requirement}>
                  <CheckIcon />
                  {requirement}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.path} aria-labelledby="zeal-path">
            <h2 id="zeal-path" className={styles.pathTitle}>
              <TrendIcon />
              Qué suma a tu ZEAL Path
            </h2>
            <ul className={styles.skills}>
              {project.skills.map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
          </section>
        </div>

        <aside className={styles.side}>
          <section className={styles.panel} aria-labelledby="cupos-de-la-convocatoria">
            <h2 id="cupos-de-la-convocatoria" className={styles.panelTitle}>
              Cupos
            </h2>
            <SpotsMeter spots={spots} />
            <ApplyButton title={project.title} spots={spots} closed={closing.closed} />
          </section>
          <section className={styles.atomic} aria-labelledby="asignacion-unica">
            <h2 id="asignacion-unica" className={styles.atomicTitle}>
              <LockIcon />
              El cupo se asigna una sola vez
            </h2>
            <p>La asignación es atómica: nadie queda con un cupo que ya no existe.</p>
          </section>
        </aside>
      </div>
    </motion.div>
  );
}
