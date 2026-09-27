import { AnimatePresence, motion } from 'motion/react';
import type { Slot } from '@/features/availability/model/slot';
import {
  formatLongDate,
  formatTime,
  formatWeekdayShort,
  isSameDay,
  toIsoDate,
} from '@/shared/lib/dates';
import { isBookable } from '../model/weekSlots';
import styles from './WeekSlots.module.css';

interface WeekSlotsProps {
  days: readonly Date[];
  /** Bloques de la semana que aún no empiezan, libres u ocupados, en orden. */
  slots: readonly Slot[];
  now: number;
  loading: boolean;
  selectedId: string | null;
  onSelect: (slot: Slot) => void;
}

function timeRange(slot: Slot): string {
  return `${formatTime(new Date(slot.startsAt))} – ${formatTime(new Date(slot.endsAt))}`;
}

/**
 * Figma B3 · bloques horarios de la semana, una columna por día: libre (se puede elegir),
 * seleccionado u ocupado. Cuando alguien reserva un bloque en vivo, pasa a "Ocupado" con una
 * transición corta que se nota sin distraer.
 */
export function WeekSlots({
  days,
  slots,
  now,
  loading,
  selectedId,
  onSelect,
}: Readonly<WeekSlotsProps>) {
  const today = new Date(now);

  return (
    <ol className={styles.week}>
      {days.map((day) => {
        const daySlots = slots.filter((slot) => isSameDay(new Date(slot.startsAt), day));
        const isToday = isSameDay(day, today);
        const isPast = !isToday && day.getTime() < today.getTime();
        const label = formatLongDate(day);

        return (
          <li key={toIsoDate(day)} className={styles.day} data-today={isToday} data-past={isPast}>
            <h3 className={styles.dayName}>
              <span aria-hidden="true">{formatWeekdayShort(day)}</span>
              <span className="visually-hidden">{label}</span>
              {isToday && <span className={styles.todayTag}>Hoy</span>}
            </h3>
            <ul className={styles.slots} aria-label={`Bloques del ${label.toLowerCase()}`}>
              <AnimatePresence initial={false}>
                {daySlots.map((slot) => (
                  <motion.li
                    key={slot.id}
                    layout
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    {isBookable(slot) ? (
                      <button
                        type="button"
                        className={styles.slot}
                        aria-pressed={slot.id === selectedId}
                        onClick={() => {
                          onSelect(slot);
                        }}
                      >
                        {timeRange(slot)}
                      </button>
                    ) : (
                      <motion.span
                        key="ocupado"
                        className={styles.slot}
                        data-status="ocupado"
                        initial={{ scale: 0.92 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                      >
                        {timeRange(slot)}
                        <span className={styles.slotState}>Ocupado</span>
                      </motion.span>
                    )}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            {daySlots.length === 0 &&
              (loading ? (
                <span className={styles.placeholder} aria-hidden="true" />
              ) : (
                <p className={styles.none}>{isPast ? 'Ya pasó' : 'Sin bloques'}</p>
              ))}
          </li>
        );
      })}
    </ol>
  );
}
