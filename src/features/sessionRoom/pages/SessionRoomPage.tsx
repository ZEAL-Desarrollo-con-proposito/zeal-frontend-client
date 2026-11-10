import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ChatConversation } from '@/features/chat/components/ChatConversation';
import { conversationId } from '@/features/chat/model/chatMessage';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { useVideoCall } from '@/features/videoCall/hooks/useVideoCall';
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
import { useRoom } from '../hooks/useRoom';
import type { Room, RoomPhase } from '../model/room';
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

/** Con la sala en estas fases ya no hay sesión: si la llamada sigue abierta, se cierra. */
const OVER: ReadonlySet<RoomPhase['kind']> = new Set(['cancelled', 'finished', 'closed']);

/**
 * Sala de una sesión 1:1 (Figma C2), a pantalla completa. El psicólogo la activa dentro de la
 * ventana que fija el servidor; el empleado espera y entra en cuanto se activa, sin recargar.
 * Adentro, el video de los dos pasa por el servidor de medios, como en los talleres (ADR-14).
 */
export function SessionRoomPage({ exit }: Readonly<SessionRoomPageProps>) {
  const { reservationId = '' } = useParams();
  const user = useCurrentUser();
  const host = user.role === 'PSICOLOGO';
  const navigate = useNavigate();
  const now = useNow();
  const room = useRoom(reservationId);
  const activation = useActivateRoom(reservationId);
  const call = useVideoCall();
  // En la sesión 1:1 el chat empieza abierto: es la misma conversación de Mensajes.
  const [chatOpen, setChatOpen] = useState(true);
  useDocumentTitle('Sala de sesión');

  const over = room.data !== null && OVER.has(roomPhase(room.data, now).kind);
  const joined = call.phase.kind === 'joined';
  const { leave: hangUp } = call;
  useEffect(() => {
    if (over && joined) {
      hangUp();
    }
  }, [over, joined, hangUp]);

  async function activateAndJoin() {
    const activated = await activation.activate();
    if (activated === null) {
      return;
    }
    room.reload();
    const phase = roomPhase(activated, Date.now());
    if (phase.kind === 'active') {
      await call.join(phase.connection);
    }
  }

  function leave() {
    call.leave();
    void navigate(exit.to);
  }

  function content(data: Room) {
    const participant = data.participant.fullName;
    if (call.phase.kind === 'joined') {
      const conversation = host
        ? conversationId(data.participant.id, user.id)
        : conversationId(user.id, data.participant.id);
      return (
        <CallView
          participant={participant}
          selfName={user.fullName}
          snapshot={call.phase.snapshot}
          media={call.media}
          mediaError={call.mediaError}
          onToggleAudio={call.toggleAudio}
          onToggleVideo={call.toggleVideo}
          onLeave={leave}
          chat={{
            open: chatOpen,
            unread: 0,
            onToggle: () => {
              setChatOpen((open) => !open);
            },
          }}
          chatPanel={
            <ChatConversation
              conversationId={conversation}
              peer={data.participant}
              currentUserId={user.id}
            />
          }
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
        onJoin={(connection) => void call.join(connection)}
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
        Cifrado en tránsito · solo ustedes dos
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
