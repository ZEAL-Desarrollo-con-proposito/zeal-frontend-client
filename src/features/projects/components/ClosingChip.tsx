import type { Closing } from '../model/project';
import styles from './ClosingChip.module.css';

/** "Cierra en 2 días": coral cuando queda poco, salvia cuando hay tiempo (Figma B8). */
export function ClosingChip({ closing }: Readonly<{ closing: Closing }>) {
  return (
    <span className={styles.chip} data-urgent={closing.urgent}>
      {closing.label}
    </span>
  );
}
