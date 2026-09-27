import { AnimatePresence, motion } from 'motion/react';
import { EMPLOYEE_PATHS } from '@/app/paths';
import type { Appointment } from '@/features/appointments/model/appointment';
import type { Slot } from '@/features/availability/model/slot';
import { formatLongDate, formatTime } from '@/shared/lib/dates';
import { Badge } from '@/shared/ui/Badge/Badge';
import { Button } from '@/shared/ui/Button/Button';
import { LinkButton } from '@/shared/ui/Button/LinkButton';
import styles from './BookingPanel.module.css';

interface BookingPanelProps {
  psychologistName: string;
  selected: Slot | null;
  booked: Appointment | null;
  onBook: (slot: Slot) => void;
  onClear: () => void;
  onDismissBooked: () => void;
}

function timeRange({ startsAt, endsAt }: Pick<Slot, 'startsAt' | 'endsAt'>): string {
  return `${formatTime(new Date(startsAt))} – ${formatTime(new Date(endsAt))}`;
}

const panelMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: 'easeOut' },
} as const;

/**
 * Figma B3 · "Resumen de tu reserva" y B14 · "Tu sesión quedó agendada": acompaña la elección
 * del bloque hasta confirmar la cita.
 */
export function BookingPanel({
  psychologistName,
  selected,
  booked,
  onBook,
  onClear,
  onDismissBooked,
}: Readonly<BookingPanelProps>) {
  return (
    <section className={styles.panel} aria-label="Tu reserva" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        {booked !== null && (
          <motion.div key={`agendada-${booked.id}`} className={styles.content} {...panelMotion}>
            <svg className={styles.check} viewBox="0 0 48 48" aria-hidden="true">
              <circle cx="24" cy="24" r="22" />
              <motion.path
                d="M15 24.5l6.5 6.5L33 18"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.35, ease: 'easeOut', delay: 0.1 }}
              />
            </svg>
            <h2 className={styles.title}>Tu sesión quedó agendada</h2>
            <dl className={styles.details}>
              <div>
                <dt>Profesional</dt>
                <dd>{booked.psychologist.fullName}</dd>
              </div>
              <div>
                <dt>Fecha</dt>
                <dd>{formatLongDate(new Date(booked.startsAt))}</dd>
              </div>
              <div>
                <dt>Hora</dt>
                <dd>{timeRange(booked)}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>
                  <Badge tone="sage">Confirmada</Badge>
                </dd>
              </div>
            </dl>
            <div className={styles.actions}>
              <LinkButton to={EMPLOYEE_PATHS.appointments}>Ver mis citas</LinkButton>
              <Button variant="outline" onClick={onDismissBooked}>
                Agendar otra
              </Button>
            </div>
          </motion.div>
        )}

        {booked === null && selected !== null && (
          <motion.div key={`resumen-${selected.id}`} className={styles.content} {...panelMotion}>
            <h2 className={styles.title}>Resumen de tu reserva</h2>
            <dl className={styles.details}>
              <div>
                <dt>Profesional</dt>
                <dd>{psychologistName}</dd>
              </div>
              <div>
                <dt>Fecha</dt>
                <dd>{formatLongDate(new Date(selected.startsAt))}</dd>
              </div>
              <div>
                <dt>Hora</dt>
                <dd>{timeRange(selected)}</dd>
              </div>
              <div>
                <dt>Modalidad</dt>
                <dd>Videollamada 1:1</dd>
              </div>
            </dl>
            <div className={styles.actions}>
              <Button
                onClick={() => {
                  onBook(selected);
                }}
              >
                Agendar cita
              </Button>
              <Button variant="outline" onClick={onClear}>
                Cancelar
              </Button>
            </div>
          </motion.div>
        )}

        {booked === null && selected === null && (
          <motion.div key="sin-bloque" className={styles.content} {...panelMotion}>
            <h2 className={styles.title}>Agenda tu sesión</h2>
            <p className={styles.hint}>
              Elige un bloque libre de la semana para ver el resumen y confirmar tu cita.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
