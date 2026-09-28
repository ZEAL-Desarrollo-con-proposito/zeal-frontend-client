import { Link, useNavigate, useParams } from 'react-router';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { ApiError } from '@/shared/api/errors';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { useNow } from '@/shared/hooks/useNow';
import { formatLongDate, formatTime } from '@/shared/lib/dates';
import { Badge } from '@/shared/ui/Badge/Badge';
import { Button } from '@/shared/ui/Button/Button';
import { LinkButton } from '@/shared/ui/Button/LinkButton';
import { ArrowLeftIcon, LockIcon } from '@/shared/ui/icons';
import { CallView } from '../components/CallView';
import { RoomLobby } from '../components/RoomLobby';
import { useActivateRoom } from '../hooks/useActivateRoom';
import { useCall } from '../hooks/useCall';
import { useRoom } from '../hooks/useRoom';
import type { Room } from '../model/room';
import { roomBadge, roomPhase } from '../model/room';
import styles from './SessionRoomPage.module.css';

export interface RoomExit {
  to: string;
  label: string;
}

interface SessionRoomPageProps {
  /** A dónde vuelve la persona al salir (su agenda o sus citas). */
  exit: RoomExit;
}

/**
 * Sala de una sesión 1:1 (Figma C2), a pantalla completa. El psicólogo la activa dentro de la
 * ventana que fija el servidor; el empleado espera y entra en cuanto se activa, sin recargar.
 * Adentro, el video de los dos se conecta por WebRTC.
 */
export function SessionRoomPage({ exit }: Readonly<SessionRoomPageProps>) {
  const { reservationId = '' } = useParams();
  const user = useCurrentUser();
  const host = user.role === 'PSICOLOGO';
  const navigate = useNavigate();
  const now = useNow();
  const room = useRoom(reservationId);
  const activation = useActivateRoom(reservationId);
  const call = useCall({
    reservationId,
    role: host ? 'caller' : 'callee',
    iceServers: room.data?.iceServers ?? [],
  });
  useDocumentTitle('Sala de sesión');

  async function activateAndJoin() {
    if (await activation.activate()) {
      room.reload();
      await call.join();
    }
  }

  function leave() {
    call.leave();
    void navigate(exit.to);
  }

  function content(data: Room) {
    const participant = data.participant.fullName;
    if (call.phase.kind === 'joined') {
      return (
        <CallView
          participant={participant}
          selfName={user.fullName}
          call={call.call}
          localStream={call.phase.localStream}
          media={call.media}
          onToggleAudio={call.toggleAudio}
          onToggleVideo={call.toggleVideo}
          onLeave={leave}
        />
      );
    }
    return (
      <RoomLobby
        phase={roomPhase(data, now)}
        participant={participant}
        host={host}
        callPhase={call.phase}
        activation={activation}
        onActivate={() => void activateAndJoin()}
        onJoin={() => void call.join()}
      />
    );
  }

  return (
    <div className={styles.room}>
      <RoomHeader room={room.data} now={now} exit={exit} />
      <main id="contenido" className={styles.main}>
        {room.data === null ? (
          <RoomPending status={room.status} error={room.error} exit={exit} onRetry={room.reload} />
        ) : (
          content(room.data)
        )}
      </main>
    </div>
  );
}

interface RoomHeaderProps {
  room: Room | null;
  now: number;
  exit: RoomExit;
}

function RoomHeader({ room, now, exit }: Readonly<RoomHeaderProps>) {
  const badge = room === null ? null : roomBadge(room, now);
  return (
    <header className={styles.header}>
      <Link to={exit.to} className={styles.back} aria-label={exit.label} title={exit.label}>
        <ArrowLeftIcon />
      </Link>
      <div className={styles.heading}>
        <h1 className={styles.title}>
          {room === null ? 'Sala de sesión' : `Sesión 1:1 · ${room.participant.fullName}`}
        </h1>
        {room !== null && (
          <p className={styles.when}>
            {formatLongDate(new Date(room.startsAt))} · {formatTime(new Date(room.startsAt))} –{' '}
            {formatTime(new Date(room.endsAt))}
          </p>
        )}
      </div>
      {badge !== null && <Badge tone={badge.tone}>{badge.label}</Badge>}
      <p className={styles.secure}>
        <LockIcon />
        Cifrado de extremo a extremo · WebRTC
      </p>
    </header>
  );
}

interface RoomPendingProps {
  status: 'loading' | 'ready' | 'error';
  error: unknown;
  exit: RoomExit;
  onRetry: () => void;
}

function RoomPending({ status, error, exit, onRetry }: Readonly<RoomPendingProps>) {
  if (status !== 'error') {
    return (
      <p className={styles.loading} aria-busy="true">
        Cargando la sesión…
      </p>
    );
  }
  if (error instanceof ApiError && error.status === 404) {
    return (
      <section className={styles.message}>
        <h2 className={styles.messageTitle}>No encontramos esta sesión</h2>
        <p>Puede que no exista o que no sea tuya.</p>
        <LinkButton to={exit.to} variant="outline">
          {exit.label}
        </LinkButton>
      </section>
    );
  }
  return (
    <section className={styles.message} role="alert">
      <h2 className={styles.messageTitle}>No pudimos abrir la sala</h2>
      <p>Revisa tu conexión e inténtalo de nuevo.</p>
      <Button variant="outline" onClick={onRetry}>
        Reintentar
      </Button>
    </section>
  );
}
