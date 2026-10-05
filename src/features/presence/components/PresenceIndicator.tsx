import type { PresenceState } from '../model/presence';
import styles from './PresenceIndicator.module.css';

const LABEL: Record<PresenceState, string> = {
  online: 'En línea',
  offline: 'Desconectado',
};

interface PresenceIndicatorProps {
  status: PresenceState | null;
}

/**Punto y texto de presencia (HU-FE-10): teniendo color, texto y dice el status*/
export function PresenceIndicator({ status }: Readonly<PresenceIndicatorProps>) {
  if (status === null) {
    return null;
  }
  return (
    <p className={styles.indicator} data-status={status} role="status">
      {LABEL[status]}
    </p>
  );
}
