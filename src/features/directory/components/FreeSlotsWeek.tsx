import { AnimatePresence, motion } from 'motion/react';
import type { Slot } from '@/features/availability/model/slot';
import {
  formatLongDate,
  formatTime,
  formatWeekdayShort,
  isSameDay,
  toIsoDate,
} from '@/shared/lib/dates';
import styles from './FreeSlotsWeek.module.css';

interface FreeSlotsWeekProps {
  days: readonly Date[];
  /** Bloques reservables de la semana, en orden. */
  slots: readonly Slot[];
  now: number;
  loading: boolean;
  selectedId: string | null;
  onSelect: (slot: Slot) => void;
}

/**
 * Figma B13 · "Próximos bloques libres", extendido a la semana (una columna por día), con la
 * selección de B3: se elige un bloque para agendarlo. Los bloques aparecen y desaparecen con una
 * transición corta cuando cambian en vivo.
 */
export function FreeSlotsWeek({
  days,
  slots,
  now,
  loading,
  selectedId,
  onSelect,
}: Readonly<FreeSlotsWeekProps>) {
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
            <ul className={styles.slots} aria-label={`Bloques libres del ${label.toLowerCase()}`}>
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
                    <button
                      type="button"
                      className={styles.slot}
                      aria-pressed={slot.id === selectedId}
                      onClick={() => {
                        onSelect(slot);
                      }}
                    >
                      {formatTime(new Date(slot.startsAt))} – {formatTime(new Date(slot.endsAt))}
                    </button>
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
