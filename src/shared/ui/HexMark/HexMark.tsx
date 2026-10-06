import { titleInitials, toneFor } from './initials';
import styles from './HexMark.module.css';

interface HexMarkProps {
  /** Lo que identifica el hexágono: su id fija el color y su título, las iniciales. */
  subject: { id: string; title: string };
  size?: 'md' | 'lg';
}

/** Hexágono con iniciales (Figma B6, B8 y B11); decorativo, el título vecino da el significado. */
export function HexMark({ subject, size = 'md' }: Readonly<HexMarkProps>) {
  return (
    <span
      className={styles.mark}
      data-tone={toneFor(subject.id)}
      data-size={size}
      aria-hidden="true"
    >
      {titleInitials(subject.title)}
    </span>
  );
}
