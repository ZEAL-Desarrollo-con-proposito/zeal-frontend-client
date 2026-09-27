import { motion } from 'motion/react';
import { avatarToneFor } from '@/features/directory/model/psychologist';
import { Avatar } from '@/shared/ui/Avatar/Avatar';
import { Badge } from '@/shared/ui/Badge/Badge';
import type { Appointment } from '../model/appointment';
import { appointmentBadge, appointmentWhen } from '../model/appointment';
import styles from './AppointmentList.module.css';

interface AppointmentListProps {
  appointments: readonly Appointment[];
  now: number;
  label: string;
}

/** Figma B9 · filas de citas: profesional, día y hora, y estado. */
export function AppointmentList({ appointments, now, label }: Readonly<AppointmentListProps>) {
  return (
    <ul className={styles.list} aria-label={label}>
      {appointments.map((appointment, index) => {
        const badge = appointmentBadge(appointment);
        const { psychologist } = appointment;
        return (
          <motion.li
            key={appointment.id}
            className={styles.row}
            data-status={appointment.status}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut', delay: Math.min(index, 6) * 0.04 }}
          >
            <span className={styles.person}>
              <Avatar name={psychologist.fullName} tone={avatarToneFor(psychologist.id)} />
              <span className={styles.identity}>
                <span className={styles.name}>{psychologist.fullName}</span>
                <span className={styles.title}>{psychologist.title}</span>
              </span>
            </span>
            <span className={styles.when}>{appointmentWhen(appointment, now)}</span>
            <Badge tone={badge.tone}>{badge.label}</Badge>
          </motion.li>
        );
      })}
    </ul>
  );
}
