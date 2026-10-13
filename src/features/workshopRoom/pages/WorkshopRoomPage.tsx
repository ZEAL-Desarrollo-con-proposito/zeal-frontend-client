import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '@/shared/api/errors';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { useNow } from '@/shared/hooks/useNow';
import { formatLongDate, formatTime } from '@/shared/lib/dates';
import { Badge } from '@/shared/ui/Badge/Badge';
import { Button } from '@/shared/ui/Button/Button';
import { LinkButton } from '@/shared/ui/Button/LinkButton';
import { ArrowLeftIcon, LockIcon } from '@/shared/ui/icons';
import { GroupCallView } from '../components/GroupCallView';
import { WorkshopRoomLobby } from '../components/WorkshopRoomLobby';
import { useGroupCall } from '../hooks/useGroupCall';
import { useWorkshopRoom } from '../hooks/useWorkshopRoom';
import type { WorkshopRoom } from '../model/workshopRoom';
import { workshopRoomPhase } from '../model/workshopRoom';
import styles from './WorkshopRoomPage.module.css';

export interface WorkshopRoomExit {
  to: string;
  label: string;
}

interface WorkshopRoomPageProps {
  /** A dónde vuelve la persona al salir (sus talleres o el panel de talleres de la empresa). */
  exit: WorkshopRoomExit;
}

/** El reloj se consulta seguido: la sala abre y cierra a una hora exacta. */
const CLOCK_REFRESH_MS = 5_000;

/**
 * Sala de video grupal de un taller (RT-3 en grupo), a pantalla completa. Abre 10 minutos antes
 * y cierra cuando el taller termina; entran la empresa anfitriona y las personas inscritas. El
 * audio y el video pasan por el servidor de medios (SFU), que reparte cada señal a todos.
 */
export function WorkshopRoomPage({ exit }: Readonly<WorkshopRoomPageProps>) {
  const { workshopId = '' } = useParams();
  const navigate = useNavigate();
  const now = useNow(CLOCK_REFRESH_MS);
  const room = useWorkshopRoom(workshopId);
  const call = useGroupCall();
  const phase = room.data === null ? null : workshopRoomPhase(room.data, now);
  useDocumentTitle('Sala del taller');

  const stale = phase?.kind === 'stale' && room.status === 'ready';
  const { reload } = room;
  useEffect(() => {
    if (stale) {
      reload();
    }
  }, [stale, reload]);

  // Cuando el taller termina, la llamada se cierra para todos los que sigan adentro.
  const finished = phase?.kind === 'finished';
  const joined = call.phase.kind === 'joined';
  const { leave } = call;
  useEffect(() => {
    if (finished && joined) {
      leave();
    }
  }, [finished, joined, leave]);

  function leaveRoom() {
    call.leave();
    void navigate(exit.to);
  }

  function content(data: WorkshopRoom) {
    const current = workshopRoomPhase(data, now);
    if (call.phase.kind === 'joined') {
      return (
        <GroupCallView
          snapshot={call.phase.snapshot}
          media={call.media}
          mediaError={call.mediaError}
          onToggleAudio={call.toggleAudio}
          onToggleVideo={call.toggleVideo}
          onLeave={leaveRoom}
          messages={call.messages}
          chatFailed={call.chatFailed}
          onSendMessage={call.sendMessage}
        />
      );
    }
    return (
      <WorkshopRoomLobby
        phase={current}
        role={data.role}
        enrolled={data.enrolled}
        callPhase={call.phase}
        onJoin={(connection) => {
          void call.join(connection);
        }}
      />
    );
  }

  return (
    <div className={styles.room}>
      <RoomHeader room={room.data} exit={exit} />
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

function RoomHeader({
  room,
  exit,
}: Readonly<{ room: WorkshopRoom | null; exit: WorkshopRoomExit }>) {
  return (
    <header className={styles.header}>
      <Link to={exit.to} className={styles.back} aria-label={exit.label} title={exit.label}>
        <ArrowLeftIcon />
      </Link>
      <div className={styles.heading}>
        <h1 className={styles.title}>
          {room === null ? 'Sala del taller' : `Taller · ${room.title}`}
        </h1>
        {room !== null && (
          <p className={styles.when}>
            {formatLongDate(new Date(room.startsAt))} · {formatTime(new Date(room.startsAt))} –{' '}
            {formatTime(new Date(room.endsAt))}
          </p>
        )}
      </div>
      {room !== null && (
        <Badge tone={room.role === 'ANFITRION' ? 'sage' : 'neutral'}>
          {room.role === 'ANFITRION' ? 'Anfitrión' : 'Participante'}
        </Badge>
      )}
      <p className={styles.secure}>
        <LockIcon />
        Solo personas inscritas
      </p>
    </header>
  );
}

interface RoomPendingProps {
  status: 'loading' | 'ready' | 'error';
  error: unknown;
  exit: WorkshopRoomExit;
  onRetry: () => void;
}

function RoomPending({ status, error, exit, onRetry }: Readonly<RoomPendingProps>) {
  if (status !== 'error') {
    return (
      <p className={styles.loading} aria-busy="true">
        Cargando la sala…
      </p>
    );
  }
  if (error instanceof ApiError && error.status === 404) {
    return (
      <section className={styles.message}>
        <h2 className={styles.messageTitle}>No encontramos esta sala</h2>
        <p>Puede que el taller no exista o que no estés inscrito.</p>
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
