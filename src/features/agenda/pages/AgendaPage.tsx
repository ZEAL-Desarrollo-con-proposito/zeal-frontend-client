import { PSYCHOLOGIST_PATHS } from '@/app/paths';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { useNow } from '@/shared/hooks/useNow';
import { useWeekParam } from '@/shared/hooks/useWeekParam';
import { formatLongDate, isSameDay, startOfWeek, workweekEnd } from '@/shared/lib/dates';
import { Button } from '@/shared/ui/Button/Button';
import { LinkButton } from '@/shared/ui/Button/LinkButton';
import { WeekNavigator } from '@/shared/ui/WeekNavigator/WeekNavigator';
import { AgendaList } from '../components/AgendaList';
import { NextSessionCard } from '../components/NextSessionCard';
import { useAgenda } from '../hooks/useAgenda';
import { groupByDay, nextSession, summarize } from '../model/reservation';
import styles from './AgendaPage.module.css';

/** Figma C1 · Mi agenda — reservas de la semana del psicólogo (HU-FE-03). */
export function AgendaPage() {
  const user = useCurrentUser();
  const now = useNow();
  const today = new Date(now);
  const [weekStart, setWeek] = useWeekParam();
  const weekEnd = workweekEnd(weekStart);
  const isCurrentWeek = isSameDay(weekStart, startOfWeek(today));
  const { status, reservations, reload } = useAgenda(weekStart, weekEnd, user.id);
  const summary = summarize(reservations);
  const days = groupByDay(reservations);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <h1 className={styles.title}>Mi agenda</h1>
          <p className={styles.subtitle}>Hoy es {formatLongDate(today).toLowerCase()}</p>
        </div>
        <LinkButton to={PSYCHOLOGIST_PATHS.availability} variant="outline">
          Gestionar disponibilidad
        </LinkButton>
      </header>

      <dl className={styles.kpis} aria-label="Cifras de la semana">
        <div className={styles.kpi}>
          <dt>Sesiones de la semana</dt>
          <dd>{summary.sessions}</dd>
        </div>
        <div className={styles.kpi}>
          <dt>Por atender</dt>
          <dd>{summary.confirmed}</dd>
        </div>
        <div className={styles.kpi}>
          <dt>Canceladas</dt>
          <dd>{summary.cancelled}</dd>
        </div>
      </dl>

      <div className={styles.layout}>
        <section
          className={styles.card}
          aria-label="Reservas de la semana"
          aria-busy={status === 'loading'}
        >
          <WeekNavigator weekStart={weekStart} weekEnd={weekEnd} onChange={setWeek} />
          {status === 'error' && (
            <div className={styles.feedback} role="alert">
              <p>No pudimos cargar tu agenda.</p>
              <Button variant="outline" onClick={reload}>
                Reintentar
              </Button>
            </div>
          )}
          {status === 'ready' && days.length === 0 && (
            <p className={styles.feedback}>No tienes reservas esta semana.</p>
          )}
          <div className={styles.results}>
            <AgendaList days={days} now={now} />
          </div>
        </section>
        {isCurrentWeek && (
          <aside className={styles.side} aria-label="Resumen de hoy">
            <NextSessionCard reservation={nextSession(reservations, now)} now={now} />
          </aside>
        )}
      </div>
    </div>
  );
}
