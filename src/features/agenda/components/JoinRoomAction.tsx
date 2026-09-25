import { useId } from 'react';
import { motion } from 'motion/react';
import { formatTime } from '@/shared/lib/dates';
import { Button } from '@/shared/ui/Button/Button';
import type { JoinState, Reservation } from '../model/reservation';
import { joinState } from '../model/reservation';
import { JoinRoomLink } from './JoinRoomLink';
import styles from './JoinRoomAction.module.css';

interface JoinRoomActionProps {
  reservation: Reservation;
  now: number;
}

/**
 * "Entrar a la sala" según la ventana que fijó el servidor: habilitado dentro de ella,
 * deshabilitado con la hora de apertura antes, y un aviso cuando ya cerró.
 */
export function JoinRoomAction({ reservation, now }: Readonly<JoinRoomActionProps>) {
  const state = joinState(reservation, now);
  if (state.kind === 'unavailable') {
    return null;
  }
  return (
    <motion.div
      key={state.kind}
      className={styles.action}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <JoinControl reservation={reservation} state={state} />
    </motion.div>
  );
}

interface JoinControlProps {
  reservation: Reservation;
  state: Exclude<JoinState, { kind: 'unavailable' }>;
}

function JoinControl({ reservation, state }: Readonly<JoinControlProps>) {
  const hintId = useId();
  if (state.kind === 'open') {
    return <JoinRoomLink reservation={reservation} />;
  }
  if (state.kind === 'closed') {
    return <p className={styles.hint}>La sala de esta sesión ya cerró.</p>;
  }
  return (
    <>
      <Button disabled aria-describedby={hintId}>
        Entrar a la sala
      </Button>
      <p id={hintId} className={styles.hint}>
        La sala abre a las {formatTime(state.opensAt)}
      </p>
    </>
  );
}
