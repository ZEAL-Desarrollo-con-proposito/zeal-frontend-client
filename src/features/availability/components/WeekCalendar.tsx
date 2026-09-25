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
  /** Atajo con el mouse o el dedo: una hora libre prellena el formulario "Abrir franja". */
  onSelectHour: (day: Date, hour: number) => void;
  /** Una franja abierta se puede eliminar (con confirmación); las reservadas no. */
  onSelectSlot: (slot: Slot) => void;
}

/** Grilla semanal por horas (Figma C8). Cada día es una lista de franjas para lectores de pantalla. */
export function WeekCalendar({
  days,
  slots,
  status,
  onRetry,
  onSelectHour,
  onSelectSlot,
}: Readonly<WeekCalendarProps>) {
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
                  {/* Redundante para teclado y lectores de pantalla: el formulario cubre ese camino. */}
                  {CALENDAR_HOURS.map((hour, hourIndex) => (
                    <button
                      key={hour}
                      type="button"
                      tabIndex={-1}
                      aria-hidden="true"
                      title={`Abrir franja el ${formatLongDate(day).toLowerCase()} a las ${String(hour)}:00`}
                      className={styles.hourCell}
                      style={{ top: hourIndex * HOUR_HEIGHT_PX, height: HOUR_HEIGHT_PX }}
                      onClick={() => {
                        onSelectHour(day, hour);
                      }}
                    />
                  ))}
                  <ul className={styles.slotList}>
                    <AnimatePresence initial={false}>
                      {slotsOfDay(slots, day).map((slot) => (
                        // La clave incluye el estado: un cambio en vivo (p. ej. reservada) se anima.
                        <SlotBlock
                          key={`${slot.id}-${slot.status}`}
                          slot={slot}
                          onSelect={onSelectSlot}
                        />
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

interface SlotBlockProps {
  slot: Slot;
  onSelect: (slot: Slot) => void;
}

function SlotBlock({ slot, onSelect }: Readonly<SlotBlockProps>) {
  const { top, height } = slotBox(slot);
  const isReserved = slot.status === 'RESERVADA';
  const start = new Date(slot.startsAt);
  const timeRange = `${formatTime(start)} – ${formatTime(new Date(slot.endsAt))}`;
  const statusLabel = SLOT_STATUS_LABEL[slot.status];
  const content = (
    <>
      <span className={styles.slotTime}>{timeRange}</span>
      <span className={styles.slotStatus}>{statusLabel}</span>
    </>
  );

  return (
    <motion.li
      layout
      className={cx(styles.slot, isReserved ? styles.reserved : styles.available)}
      style={{ top, height }}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {isReserved ? (
        content
      ) : (
        <button
          type="button"
          className={styles.slotButton}
          // Incluye el texto visible (WCAG 2.5.3) y el día, que en la grilla solo da la columna.
          aria-label={`Eliminar franja del ${formatLongDate(start).toLowerCase()}, ${timeRange} (${statusLabel})`}
          onClick={() => {
            onSelect(slot);
          }}
        >
          {content}
        </button>
      )}
    </motion.li>
  );
}
