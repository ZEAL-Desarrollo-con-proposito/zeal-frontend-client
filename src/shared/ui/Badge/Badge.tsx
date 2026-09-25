import type { ReactNode } from 'react';
import styles from './Badge.module.css';

export type BadgeTone = 'sage' | 'teal' | 'mauve' | 'coral' | 'neutral';

interface BadgeProps {
  tone: BadgeTone;
  children: ReactNode;
}

/** Chip de estado del manual de identidad (IBM Plex Mono, mayúsculas, color semántico). */
export function Badge({ tone, children }: Readonly<BadgeProps>) {
  return (
    <span className={styles.badge} data-tone={tone}>
      {children}
    </span>
  );
}
