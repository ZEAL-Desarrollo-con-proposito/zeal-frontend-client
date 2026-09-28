import { motion } from 'motion/react';
import { formatTime } from '@/shared/lib/dates';
import { Avatar } from '@/shared/ui/Avatar/Avatar';
import { Button } from '@/shared/ui/Button/Button';
import { AlertIcon } from '@/shared/ui/icons';
import { MEDIA_ERROR_MESSAGES } from '../call/localMedia';
import type { CallPhase } from '../hooks/useCall';
import type { RoomPhase } from '../model/room';
import styles from './RoomLobby.module.css';

interface RoomLobbyProps {
  phase: RoomPhase;
  /** La otra persona de la sesión. */
  participant: string;
  /** El psicólogo activa la sala; el empleado espera a que lo haga. */
  host: boolean;
  callPhase: CallPhase;
  activation: { pending: boolean; error: string | null };
  onActivate: () => void;
  onJoin: () => void;
}

interface LobbyView {
  state: string;
  title: string;
  detail: string;
}

const NO_ROOM = 'No hay una sala abierta para esta reserva.';

function lobbyView(phase: RoomPhase, participant: string, host: boolean): LobbyView {
  switch (phase.kind) {
    case 'upcoming':
      return {
        state: 'upcoming',
        title: `La sala abre a las ${formatTime(phase.opensAt)}`,
        detail: 'Esta página se habilitará sola cuando llegue la hora; no necesitas recargarla.',
      };
    case 'closed':
      return {
        state: 'closed',
        title: 'La sala ya cerró',
        detail: 'La ventana para entrar a esta sesión terminó.',
      };
    case 'cancelled':
      return { state: 'closed', title: 'Esta sesión fue cancelada', detail: NO_ROOM };
    case 'finished':
      return { state: 'closed', title: 'Esta sesión ya finalizó', detail: NO_ROOM };
    case 'scheduled':
      return host
        ? {
            state: 'scheduled',
            title: 'Activa la sala para empezar',
            detail: `Al activarla, ${participant} podrá entrar y se encenderán tu cámara y tu micrófono.`,
          }
        : {
            state: 'waiting',
            title: `Esperando a ${participant}`,
            detail: `La sala se abrirá aquí en cuanto ${participant} la active; no necesitas recargar la página.`,
          };
    case 'active':
      return host
        ? {
            state: 'active',
            title: 'La sala está activa',
            detail: `Vuelve a entrar a la llamada con ${participant}.`,
          }
        : {
            state: 'active',
            title: 'La sala está lista',
            detail: `${participant} ya activó la sala. Al entrar se encenderán tu cámara y tu micrófono.`,
          };
  }
}

/**
 * Vestíbulo de la sala: cuándo abre, "Activar sala" para el psicólogo, la sala de espera del
 * empleado (cambia sola cuando se activa) y los avisos si la cámara no enciende.
 */
export function RoomLobby({
  phase,
  participant,
  host,
  callPhase,
  activation,
  onActivate,
  onJoin,
}: Readonly<RoomLobbyProps>) {
  const view = lobbyView(phase, participant, host);
  const starting = callPhase.kind === 'starting';
  const mediaError =
    callPhase.kind === 'media-error' ? MEDIA_ERROR_MESSAGES[callPhase.reason] : null;

  function action() {
    if (view.state === 'scheduled') {
      let label = 'Activar sala';
      if (activation.pending) {
        label = 'Activando…';
      } else if (starting) {
        label = 'Encendiendo tu cámara…';
      }
      return (
        <Button onClick={onActivate} disabled={activation.pending || starting}>
          {label}
        </Button>
      );
    }
    if (view.state === 'active') {
      let label = mediaError === null ? 'Entrar a la llamada' : 'Reintentar';
      if (starting) {
        label = 'Encendiendo tu cámara…';
      }
      return (
        <Button onClick={onJoin} disabled={starting}>
          {label}
        </Button>
      );
    }
    return null;
  }

  return (
    // Región viva estable: anuncia los cambios que llegan solos (p. ej. la sala se activó).
    <div aria-live="polite" className={styles.live}>
      <motion.section
        key={view.state}
        className={styles.lobby}
        data-state={view.state}
        aria-label="Estado de la sala"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        {view.state === 'waiting' ? (
          <WaitingSignal name={participant} />
        ) : (
          <motion.span
            className={styles.signal}
            aria-hidden="true"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 14, delay: 0.1 }}
          />
        )}
        <h2 className={styles.title}>{view.title}</h2>
        <p className={styles.detail}>{view.detail}</p>
        {mediaError !== null && (
          <div role="alert" className={styles.alert}>
            <AlertIcon />
            <p>
              <strong>{mediaError.title}.</strong> {mediaError.detail}
            </p>
          </div>
        )}
        {activation.error !== null && (
          <p role="alert" className={styles.alert}>
            <AlertIcon />
            {activation.error}
          </p>
        )}
        {action()}
      </motion.section>
    </div>
  );
}

/** Sala de espera: la otra persona "late" suavemente mientras se espera a que active la sala. */
function WaitingSignal({ name }: Readonly<{ name: string }>) {
  return (
    <span className={styles.waiting} aria-hidden="true">
      <motion.span
        className={styles.ring}
        animate={{ scale: [1, 1.45], opacity: [0.55, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
      />
      <Avatar name={name} tone="sage" size="lg" />
    </span>
  );
}
