import { motion } from 'motion/react';
import { formatTime } from '@/shared/lib/dates';
import { Button } from '@/shared/ui/Button/Button';
import { AlertIcon } from '@/shared/ui/icons';
import type { GroupCallPhase } from '../hooks/useGroupCall';
import type {
  WorkshopRoomConnection,
  WorkshopRoomPhase,
  WorkshopRoomRole,
} from '../model/workshopRoom';
import styles from './WorkshopRoomLobby.module.css';

interface WorkshopRoomLobbyProps {
  phase: WorkshopRoomPhase;
  role: WorkshopRoomRole;
  enrolled: number;
  callPhase: GroupCallPhase;
  onJoin: (connection: WorkshopRoomConnection) => void;
}

interface LobbyView {
  state: 'upcoming' | 'open' | 'closed';
  title: string;
  detail: string;
}

function lobbyView(phase: WorkshopRoomPhase, role: WorkshopRoomRole, enrolled: number): LobbyView {
  switch (phase.kind) {
    case 'upcoming':
      return {
        state: 'upcoming',
        title: `La sala abre a las ${formatTime(phase.opensAt)}`,
        detail:
          'Abre 10 minutos antes del taller. Esta página se habilitará sola; no necesitas recargarla.',
      };
    case 'finished':
      return {
        state: 'closed',
        title: 'Este taller ya terminó',
        detail: 'La sala se cerró al finalizar el taller.',
      };
    case 'stale':
      return { state: 'closed', title: 'Actualizando la sala…', detail: 'Un momento.' };
    case 'open':
      return role === 'ANFITRION'
        ? {
            state: 'open',
            title: 'La sala del taller está abierta',
            detail: `Entra para recibir a las ${String(enrolled)} personas inscritas. Se encenderán tu cámara y tu micrófono.`,
          }
        : {
            state: 'open',
            title: 'La sala del taller está abierta',
            detail:
              'Al entrar se encenderán tu cámara y tu micrófono; puedes apagarlos cuando quieras.',
          };
  }
}

/** Antes de entrar: cuándo abre la sala, o el botón para entrar mientras el taller está en curso. */
export function WorkshopRoomLobby({
  phase,
  role,
  enrolled,
  callPhase,
  onJoin,
}: Readonly<WorkshopRoomLobbyProps>) {
  const view = lobbyView(phase, role, enrolled);
  const joining = callPhase.kind === 'joining';
  let label = 'Entrar a la sala';
  if (joining) {
    label = 'Conectando…';
  } else if (callPhase.kind === 'failed') {
    label = 'Reintentar';
  } else if (callPhase.kind === 'ended') {
    label = 'Volver a entrar';
  }

  return (
    // Región viva estable: anuncia los cambios que llegan solos (p. ej. la sala abrió).
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
        <span className={styles.signal} aria-hidden="true" />
        <h2 className={styles.title}>{view.title}</h2>
        <p className={styles.detail}>{view.detail}</p>
        {phase.kind === 'open' && (
          <>
            {callPhase.kind === 'failed' && (
              <p role="alert" className={styles.alert}>
                <AlertIcon />
                No pudimos conectar el video. Revisa tu conexión e inténtalo de nuevo.
              </p>
            )}
            <Button
              onClick={() => {
                onJoin(phase.connection);
              }}
              disabled={joining}
              aria-busy={joining}
            >
              {label}
            </Button>
          </>
        )}
      </motion.section>
    </div>
  );
}
