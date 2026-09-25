import { motion } from 'motion/react';
import type { RealtimeStatus } from '@/shared/realtime/realtimeClient';
import { useRealtimeStatus } from '@/shared/realtime/useRealtime';
import styles from './RealtimeStatusBadge.module.css';

const STATUS_LABEL: Record<RealtimeStatus, string> = {
  connected: 'En línea',
  connecting: 'Conectando',
  reconnecting: 'Reconectando',
  idle: 'Sin conexión',
};

/** Figma: badge "EN LÍNEA" de la barra superior, ahora con el estado real de la conexión (RT-1). */
export function RealtimeStatusBadge() {
  const { status } = useRealtimeStatus();

  return (
    <p
      className={styles.badge}
      data-status={status}
      role="status"
      aria-label="Conexión en tiempo real"
    >
      {/* Solo animación de entrada: el texto nunca espera a que termine la salida del anterior,
          así el indicador no queda atrasado respecto al estado real (p. ej. en pestañas ocultas). */}
      <motion.span
        key={status}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
      >
        {STATUS_LABEL[status]}
      </motion.span>
    </p>
  );
}
