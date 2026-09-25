import { motion } from 'motion/react';
import { formatLongDate, formatTime, isSameDay } from '@/shared/lib/dates';
import { Avatar } from '@/shared/ui/Avatar/Avatar';
import { Badge } from '@/shared/ui/Badge/Badge';
import type { AgendaDay, Reservation } from '../model/reservation';
import { reservationBadge } from '../model/reservation';
import styles from './AgendaList.module.css';

interface AgendaListProps {
  days: AgendaDay[];
  now: number;
}

function dayTitle(day: Date, now: number): string {
  const label = formatLongDate(day);
  return isSameDay(day, new Date(now)) ? `Hoy · ${label}` : label;
}

/** Reservas de la semana agrupadas por día: empleado, fecha, hora y estado (HU-03). */
export function AgendaList({ days, now }: Readonly<AgendaListProps>) {
  return (
    <div className={styles.list}>
      {days.map(({ key, day, reservations }) => (
        <section key={key} className={styles.day} aria-labelledby={`agenda-${key}`}>
          <h3 id={`agenda-${key}`} className={styles.dayTitle}>
            {dayTitle(day, now)}
          </h3>
          <ul className={styles.rows}>
            {reservations.map((reservation, index) => (
              <ReservationRow
                key={reservation.id}
                reservation={reservation}
                now={now}
                index={index}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

interface ReservationRowProps {
  reservation: Reservation;
  now: number;
  index: number;
}

function ReservationRow({ reservation, now, index }: Readonly<ReservationRowProps>) {
  const badge = reservationBadge(reservation, now);
  const start = new Date(reservation.startsAt);
  const end = new Date(reservation.endsAt);

  return (
    <motion.li
      className={styles.row}
      data-status={reservation.status}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index, 6) * 0.04 }}
    >
      <span className={styles.time}>
        {formatTime(start)} – {formatTime(end)}
      </span>
      <span className={styles.person}>
        <Avatar name={reservation.employee.fullName} tone="sage" />
        <span className={styles.name}>{reservation.employee.fullName}</span>
      </span>
      <Badge tone={badge.tone}>{badge.label}</Badge>
    </motion.li>
  );
}
