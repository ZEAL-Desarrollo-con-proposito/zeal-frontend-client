import { cx } from '@/shared/lib/cx';
import styles from './HexIcon.module.css';

interface HexIconProps {
  /** Ícono SVG exportado del Figma; decorativo, el texto vecino da el significado. */
  src: string;
  tone?: 'dark' | 'soft';
  size?: 'md' | 'lg';
}

/** Ícono dentro de un hexágono: elemento distintivo de marca ("comunidad, no videollamada"). */
export function HexIcon({ src, tone = 'dark', size = 'md' }: Readonly<HexIconProps>) {
  return (
    <span className={cx(styles.hex, styles[tone], styles[size])} aria-hidden="true">
      <img src={src} alt="" width={20} height={20} />
    </span>
  );
}
