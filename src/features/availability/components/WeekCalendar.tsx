import { AnimatePresence, motion } from 'motion/react';
import { useId } from 'react';
import { formatLongDate, formatTime, formatWeekdayShort, isSameDay } from '@/shared/lib/dates';
import { cx } from '@/shared/lib/cx';
import { Button } from '@/shared/ui/Button/Button';
import {
  CALENDAR_HEIGHT_PX,
  CALENDAR_HOURS,
  HOUR_HEIGHT_PX,
  slotBox,
  slotsOfDay,
} from '../model/calendar';
import type { Slot } from '../model/slot';
import { SLOT_STATUS_LABEL } from '../model/slot';
import type { LoadStatus } from '../model/slotsState';
import styles from './WeekCalendar.module.css';

interface WeekCalendarProps {
  days: Date[];
  slots: Slot[];
  status: LoadStatus;
  onRetry: () => void;
}

/** Grilla semanal por horas (Figma C8). Cada día es una lista de franjas para lectores de pantalla. */
export function WeekCalendar({ days, slots, status, onRetry }: Readonly<WeekCalendarProps>) {
  const baseId = useId();
  const today = new Date();

  return (
    <div className={styles.calendar} aria-busy={status === 'loading'}>
      <ul className={styles.legend} aria-label="Convenciones">
        <li className={styles.legendAvailable}>Abierta</li>
        <li className={styles.legendReserved}>Reservada</li>
        <li className={styles.legendClosed}>Cerrada</li>
      </ul>

      <div className={styles.scroller}>
        <div className={styles.grid}>
          <div className={styles.timeColumn} aria-hidden="true">
            {CALENDAR_HOURS.map((hour, index) => (
              <span key={hour} className={styles.hourLabel} style={{ top: index * HOUR_HEIGHT_PX }}>
                {hour}:00
              </span>
            ))}
          </div>

          {days.map((day, index) => {
            const headerId = `${baseId}-dia-${String(index)}`;
            return (
              <section key={day.getTime()} className={styles.day} aria-labelledby={headerId}>
                <h3
                  id={headerId}
                  className={cx(styles.dayHeader, isSameDay(day, today) && styles.today)}
                >
                  <span aria-hidden="true">{formatWeekdayShort(day)}</span>
                  <span className="visually-hidden">{formatLongDate(day)}</span>
                </h3>
                <div className={styles.dayBody} style={{ height: CALENDAR_HEIGHT_PX }}>
                  <ul className={styles.slotList}>
                    <AnimatePresence initial={false}>
                      {slotsOfDay(slots, day).map((slot) => (
                        <SlotBlock key={slot.id} slot={slot} />
                      ))}
                    </AnimatePresence>
                  </ul>
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {status === 'error' && (
        <div className={styles.overlay} role="alert">
          <p>No pudimos cargar tu disponibilidad.</p>
          <Button variant="outline" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      )}
      {status === 'ready' && slots.length === 0 && (
        <p className={styles.emptyHint}>
          Aún no abres franjas esta semana. Elige un horario para empezar.
        </p>
      )}
    </div>
  );
}

function SlotBlock({ slot }: Readonly<{ slot: Slot }>) {
  const { top, height } = slotBox(slot);
  const start = new Date(slot.startsAt);
  const end = new Date(slot.endsAt);

  return (
    <motion.li
      layout
      className={cx(styles.slot, slot.status === 'RESERVADA' ? styles.reserved : styles.available)}
      style={{ top, height }}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <span className={styles.slotTime}>
        {formatTime(start)} – {formatTime(end)}
      </span>
      <span className={styles.slotStatus}>{SLOT_STATUS_LABEL[slot.status]}</span>
    </motion.li>
  );
}
