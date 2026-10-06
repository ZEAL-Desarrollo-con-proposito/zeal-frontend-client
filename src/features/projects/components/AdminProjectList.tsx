import { useId } from 'react';
import { motion } from 'motion/react';
import { Badge } from '@/shared/ui/Badge/Badge';
import { useLiveSpots } from '../hooks/useLiveSpots';
import type { AdminProject } from '../model/adminProject';
import { describeDay, projectBadge } from '../model/adminProject';
import { closingOf } from '../model/project';
import { ClosingChip } from './ClosingChip';
import { ProjectMark } from './ProjectMark';
import { SpotsMeter } from './SpotsMeter';
import styles from './AdminProjectList.module.css';

interface AdminProjectListProps {
  projects: readonly AdminProject[];
  now: number;
}

/** Convocatorias publicadas: estado, cupos en vivo, cierre y fecha de publicación. */
export function AdminProjectList({ projects, now }: Readonly<AdminProjectListProps>) {
  return (
    <ul className={styles.list} aria-label="Proyectos publicados">
      {projects.map((project, index) => (
        <AdminProjectCard key={project.id} project={project} now={now} index={index} />
      ))}
    </ul>
  );
}

interface AdminProjectCardProps {
  project: AdminProject;
  now: number;
  index: number;
}

function AdminProjectCard({ project, now, index }: Readonly<AdminProjectCardProps>) {
  // Los cupos cambian cuando alguien se postula: la tarjeta los sigue sin recargar la lista.
  const spots = useLiveSpots(project.id, project);
  const badge = projectBadge({ ...spots, closesAt: project.closesAt }, now);
  const closing = closingOf(project.closesAt, now);
  const titleId = useId();

  return (
    <motion.li
      className={styles.card}
      aria-labelledby={titleId}
      data-closed={closing.closed}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut', delay: Math.min(index, 6) * 0.04 }}
    >
      <ProjectMark project={project} />
      <div className={styles.body}>
        <div className={styles.head}>
          <h3 id={titleId} className={styles.name}>
            {project.title}
          </h3>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </div>
        <p className={styles.meta}>
          {project.area} · {project.cohort}
        </p>
        <p className={styles.summary}>{project.summary}</p>
        <SpotsMeter spots={spots} />
        <p className={styles.dates}>
          {!closing.closed && <ClosingChip closing={closing} />}
          <span>
            Postulaciones hasta el {describeDay(project.closesAt)} · Publicado el{' '}
            {describeDay(project.publishedAt)}
          </span>
        </p>
      </div>
    </motion.li>
  );
}
