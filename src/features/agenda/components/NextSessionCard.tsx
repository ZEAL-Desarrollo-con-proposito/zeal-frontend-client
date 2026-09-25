import { formatLongDate, formatTime } from '@/shared/lib/dates';
import { Avatar } from '@/shared/ui/Avatar/Avatar';
import type { Reservation } from '../model/reservation';
import { JoinRoomAction } from './JoinRoomAction';
import styles from './NextSessionCard.module.css';

interface NextSessionCardProps {
  reservation: Reservation | null;
  now: number;
}

/** Figma C1 · "Próxima sesión": tarjeta destacada en teal institucional. */
export function NextSessionCard({ reservation, now }: Readonly<NextSessionCardProps>) {
  return (
    <section className={styles.card} aria-labelledby="proxima-sesion">
      <h2 id="proxima-sesion" className={styles.label}>
        Próxima sesión
      </h2>
      {reservation === null ? (
        <p className={styles.empty}>No tienes más sesiones confirmadas esta semana.</p>
      ) : (
        <>
          <div className={styles.body}>
            <Avatar name={reservation.employee.fullName} tone="sage" />
            <div className={styles.details}>
              <p className={styles.name}>{reservation.employee.fullName}</p>
              <p className={styles.when}>
                {formatLongDate(new Date(reservation.startsAt))} ·{' '}
                {formatTime(new Date(reservation.startsAt))} –{' '}
                {formatTime(new Date(reservation.endsAt))}
              </p>
            </div>
          </div>
          <JoinRoomAction reservation={reservation} now={now} />
        </>
      )}
    </section>
  );
}
