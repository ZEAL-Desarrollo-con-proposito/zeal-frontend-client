import { addDays, formatWeekRange, startOfWeek } from '@/shared/lib/dates';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons';
import styles from './WeekNavigator.module.css';

interface WeekNavigatorProps {
  weekStart: Date;
  /** Último día que se muestra de la semana (p. ej. viernes en una grilla laboral). */
  weekEnd: Date;
  onChange: (weekStart: Date) => void;
}

export function WeekNavigator({ weekStart, weekEnd, onChange }: Readonly<WeekNavigatorProps>) {
  return (
    <div className={styles.navigator}>
      <h2 className={styles.label} aria-live="polite">
        {formatWeekRange(weekStart, weekEnd)}
      </h2>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Semana anterior"
          onClick={() => {
            onChange(addDays(weekStart, -7));
          }}
        >
          <ChevronLeftIcon />
        </button>
        <button
          type="button"
          className={styles.todayButton}
          onClick={() => {
            onChange(startOfWeek(new Date()));
          }}
        >
          Esta semana
        </button>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Semana siguiente"
          onClick={() => {
            onChange(addDays(weekStart, 7));
          }}
        >
          <ChevronRightIcon />
        </button>
      </div>
    </div>
  );
}
