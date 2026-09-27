import { motion } from 'motion/react';
import { psychologistPath } from '@/app/paths';
import { avatarToneFor } from '@/features/directory/model/psychologist';
import { Avatar } from '@/shared/ui/Avatar/Avatar';
import { Button } from '@/shared/ui/Button/Button';
import { LinkButton } from '@/shared/ui/Button/LinkButton';
import type { Appointment } from '../model/appointment';
import { appointmentWhen, timeUntil } from '../model/appointment';
import styles from './NextAppointmentCard.module.css';

interface NextAppointmentCardProps {
  appointment: Appointment;
  now: number;
  onCancel?: () => void;
}

/** Figma B9 · "Próxima cita": la cita más cercana, destacada en teal institucional. */
export function NextAppointmentCard({
                                      appointment,
                                      now,
                                      onCancel,
                                    }: Readonly<NextAppointmentCardProps>) {
  const { psychologist } = appointment;

  return (
    <motion.section
      className={styles.card}
      aria-labelledby="proxima-cita"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <div className={styles.header}>
        <h2 id="proxima-cita" className={styles.label}>
          Próxima cita
        </h2>
        <span className={styles.until}>{timeUntil(appointment, now)}</span>
      </div>
      <div className={styles.person}>
        <Avatar name={psychologist.fullName} tone={avatarToneFor(psychologist.id)} size="lg" />
        <div className={styles.details}>
          <p className={styles.name}>{psychologist.fullName}</p>
          <p className={styles.title}>{psychologist.title} · Sesión 1:1</p>
        </div>
      </div>
      <p className={styles.when}>{appointmentWhen(appointment, now)}</p>
      <div className={styles.actions}>
        <LinkButton
          to={psychologistPath(psychologist.id)}
          variant="outline"
          aria-label={`Ver el perfil de ${psychologist.fullName}`}
        >
          Ver perfil
        </LinkButton>
        {appointment.status === 'CONFIRMADA' && onCancel !== undefined && (
          <Button
            variant="outline"
            onClick={onCancel}
            aria-label={`Cancelar cita con ${psychologist.fullName}`}
          >
            Cancelar cita
          </Button>
        )}
      </div>
    </motion.section>
  );
}
