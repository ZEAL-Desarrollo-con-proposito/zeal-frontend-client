import { projectInitials, projectTone } from '../model/project';
import styles from './ProjectMark.module.css';

interface ProjectMarkProps {
  project: { id: string; title: string };
  size?: 'md' | 'lg';
}

/** Hexágono con las iniciales de la convocatoria (Figma B8 y B11); decorativo. */
export function ProjectMark({ project, size = 'md' }: Readonly<ProjectMarkProps>) {
  return (
    <span
      className={styles.mark}
      data-tone={projectTone(project.id)}
      data-size={size}
      aria-hidden="true"
    >
      {projectInitials(project.title)}
    </span>
  );
}
