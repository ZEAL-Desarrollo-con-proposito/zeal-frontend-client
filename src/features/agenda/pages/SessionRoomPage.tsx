import { motion } from 'motion/react';
import { useParams } from 'react-router';
import { PSYCHOLOGIST_PATHS } from '@/app/paths';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { ApiError } from '@/shared/api/errors';
import { useNow } from '@/shared/hooks/useNow';
import { formatLongDate, formatTime } from '@/shared/lib/dates';
import { Avatar } from '@/shared/ui/Avatar/Avatar';
import { Badge } from '@/shared/ui/Badge/Badge';
import { Button } from '@/shared/ui/Button/Button';
import { LinkButton } from '@/shared/ui/Button/LinkButton';
import { fetchReservation } from '../api/agendaApi';
import { useAgendaResource } from '../hooks/useAgendaResource';
import type { JoinState, Reservation, ReservationStatus } from '../model/reservation';
import { joinState, reservationBadge } from '../model/reservation';
import styles from './SessionRoomPage.module.css';

/**
 * Sala de una sesión 1:1 (HU-FE-03). La videollamada llega con su propia historia; aquí el
 * psicólogo ve si la sala está abierta según la ventana que fijó el servidor, y la página se
 * habilita sola cuando llega la hora o se actualiza si el paciente cancela.
 */
export function SessionRoomPage() {
  const { reservationId = '' } = useParams();
  const user = useCurrentUser();
  const now = useNow();
  const room = useAgendaResource(reservationId, user.id, (signal) =>
    fetchReservation(reservationId, signal),
  );

  function content() {
    if (room.status === 'error') {
      return <RoomError error={room.error} onRetry={room.reload} />;
    }
    if (room.data === null) {
      return (
        <p className={styles.loading} aria-busy="true">
          Cargando la sesión…
        </p>
      );
    }
    return <Room reservation={room.data} now={now} />;
  }

  return (
    <div className={styles.page}>
      <LinkButton to={PSYCHOLOGIST_PATHS.agenda} variant="outline" className={styles.back}>
        Volver a mi agenda
      </LinkButton>
      {content()}
    </div>
  );
}

interface RoomErrorProps {
  error: unknown;
  onRetry: () => void;
}

function RoomError({ error, onRetry }: Readonly<RoomErrorProps>) {
  if (error instanceof ApiError && error.status === 404) {
    return (
      <section className={styles.message}>
        <h1 className={styles.title}>No encontramos esta sesión</h1>
        <p>Puede que no exista o que no esté en tu agenda.</p>
      </section>
    );
  }
  return (
    <section className={styles.message} role="alert">
      <h1 className={styles.title}>No pudimos abrir la sala</h1>
      <p>Revisa tu conexión e inténtalo de nuevo.</p>
      <Button variant="outline" onClick={onRetry}>
        Reintentar
      </Button>
    </section>
  );
}

const UNAVAILABLE_TITLE: Record<ReservationStatus, string> = {
  CONFIRMADA: 'La sala no está disponible',
  CANCELADA: 'Esta sesión fue cancelada',
  FINALIZADA: 'Esta sesión ya finalizó',
};

function lobbyMessage(reservation: Reservation, state: JoinState) {
  const name = reservation.employee.fullName;
  switch (state.kind) {
    case 'open':
      return {
        title: 'La sala está abierta',
        detail: `Aquí se mostrará la videollamada con ${name}. La sala cierra a las ${formatTime(state.closesAt)}.`,
      };
    case 'upcoming':
      return {
        title: `La sala abre a las ${formatTime(state.opensAt)}`,
        detail: 'Esta página se habilitará sola cuando llegue la hora; no necesitas recargarla.',
      };
    case 'closed':
      return {
        title: 'La sala ya cerró',
        detail: 'La ventana para entrar a esta sesión terminó.',
      };
    case 'unavailable':
      return {
        title: UNAVAILABLE_TITLE[reservation.status],
        detail: 'No hay una sala abierta para esta reserva.',
      };
  }
}

interface RoomProps {
  reservation: Reservation;
  now: number;
}

function Room({ reservation, now }: Readonly<RoomProps>) {
  const start = new Date(reservation.startsAt);
  const badge = reservationBadge(reservation, now);
  const state = joinState(reservation, now);
  const message = lobbyMessage(reservation, state);

  return (
    <>
      <header className={styles.head}>
        <Avatar name={reservation.employee.fullName} tone="sage" />
        <div className={styles.headText}>
          <h1 className={styles.title}>Sesión con {reservation.employee.fullName}</h1>
          <p className={styles.when}>
            {formatLongDate(start)} · {formatTime(start)} –{' '}
            {formatTime(new Date(reservation.endsAt))}
          </p>
        </div>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </header>

      {/* Región viva estable: anuncia cuando la sala se abre o cierra sin que el usuario actúe. */}
      <div aria-live="polite">
        <motion.section
          key={state.kind}
          className={styles.lobby}
          data-state={state.kind}
          aria-label="Estado de la sala"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <span className={styles.signal} aria-hidden="true" />
          <h2 className={styles.lobbyTitle}>{message.title}</h2>
          <p className={styles.lobbyDetail}>{message.detail}</p>
        </motion.section>
      </div>
    </>
  );
}
