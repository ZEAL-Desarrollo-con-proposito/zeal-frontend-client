import { getInitials } from '@/shared/lib/text';
import styles from './Avatar.module.css';

export type AvatarTone = 'sage' | 'teal' | 'mauve';

interface AvatarProps {
  name: string;
  tone: AvatarTone;
  size?: 'md' | 'lg' | 'xl';
}

/** Círculo con las iniciales de la persona. */
export function Avatar({ name, tone, size = 'md' }: Readonly<AvatarProps>) {
  return (
    <span className={styles.avatar} data-tone={tone} data-size={size} role="img" aria-label={name}>
      {getInitials(name)}
    </span>
  );
}
