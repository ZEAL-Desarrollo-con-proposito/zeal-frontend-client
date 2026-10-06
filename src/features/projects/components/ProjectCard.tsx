import { useId } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { projectPath } from '@/app/paths';
import { useProjectSpots } from '../hooks/useProjectSpots';
import type { Application } from '../model/application';
import type { Project } from '../model/project';
import { closingOf } from '../model/project';
import { ApplyButton } from './ApplyButton';
import { ClosingChip } from './ClosingChip';
import { HexMark } from '@/shared/ui/HexMark/HexMark';
import { SpotsMeter } from './SpotsMeter';
import styles from './ProjectCard.module.css';

interface ProjectCardProps {
  project: Project;
  now: number;
  /** Posición en la lista: escalona la entrada de las tarjetas. */
  index: number;
  application: Application | null;
  sending: boolean;
  onApply: (projectId: string) => void;
}

/** Figma B8 · tarjeta de una convocatoria, con sus cupos al día. */
export function ProjectCard({
  project,
  now,
  index,
  application,
  sending,
  onApply,
}: Readonly<ProjectCardProps>) {
  const spots = useProjectSpots(project.id, project);
  const closing = closingOf(project.closesAt, now);
  const titleId = useId();
  const detail = projectPath(project.id);

  return (
    <motion.li
      className={styles.card}
      aria-labelledby={titleId}
      initial={{ opacity: 0, y: 16 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: { duration: 0.3, ease: 'easeOut', delay: Math.min(index, 6) * 0.06 },
      }}
      whileHover={{ y: -3, transition: { duration: 0.2, ease: 'easeOut' } }}
    >
      <HexMark subject={project} />
      <div className={styles.body}>
        <div className={styles.heading}>
          <h2 id={titleId} className={styles.title}>
            {project.title}
          </h2>
          <ClosingChip closing={closing} />
        </div>
        <p className={styles.meta}>
          {project.area} · {project.cohort}
        </p>
        <p className={styles.summary}>{project.summary}</p>
        <SpotsMeter spots={spots} />
      </div>
      <div className={styles.actions}>
        <ApplyButton
          title={project.title}
          spots={spots}
          closed={closing.closed}
          application={application}
          sending={sending}
          onApply={() => {
            onApply(project.id);
          }}
        />
        <Link to={detail} className={styles.detail} aria-label={`Ver detalle de ${project.title}`}>
          Ver detalle
        </Link>
      </div>
    </motion.li>
  );
}
