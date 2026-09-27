import { motion } from 'motion/react';
import { avatarToneFor } from '@/features/directory/model/psychologist';
import { Avatar } from '@/shared/ui/Avatar/Avatar';
import { Badge } from '@/shared/ui/Badge/Badge';
import { Button } from '@/shared/ui/Button/Button';
import type { Appointment } from '../model/appointment';
import { appointmentBadge, appointmentWhen } from '../model/appointment';
import styles from './AppointmentList.module.css';

interface AppointmentListProps {
  appointments: readonly Appointment[];
  now: number;
  label: string;
  onCancel?: (appointment: Appointment) => void;
}

/** Figma B9 · filas de citas: profesional, día y hora, estado y, si aplica, cancelar. */
export function AppointmentList({
                                  appointments,
                                  now,
                                  label,
                                  onCancel,
                                }: Readonly<AppointmentListProps>) {
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
            <span className={styles.status}>
              <Badge tone={badge.tone}>{badge.label}</Badge>
              {appointment.status === 'CONFIRMADA' && onCancel !== undefined && (
                <Button
                  variant="outline"
                  className={styles.cancel}
                  onClick={() => {
                    onCancel(appointment);
                  }}
                  aria-label={`Cancelar cita con ${psychologist.fullName}`}
                >
                  Cancelar
                </Button>
              )}
            </span>
          </motion.li>
        );
      })}
    </ul>
  );
}
