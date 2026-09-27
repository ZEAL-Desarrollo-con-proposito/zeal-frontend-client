import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Link, useLocation, useParams } from 'react-router';
import { directoryReturnPath } from '@/app/paths';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { useWeeklySlots } from '@/features/availability/hooks/useWeeklySlots';
import type { SlotEvent } from '@/features/availability/model/slotEvent';
import { ApiError } from '@/shared/api/errors';
import { useNow } from '@/shared/hooks/useNow';
import { useWeekParam } from '@/shared/hooks/useWeekParam';
import { addDays, workdaysOf, workweekEnd } from '@/shared/lib/dates';
import { Button } from '@/shared/ui/Button/Button';
import { LinkButton } from '@/shared/ui/Button/LinkButton';
import { ChevronLeftIcon } from '@/shared/ui/icons';
import { WeekNavigator } from '@/shared/ui/WeekNavigator/WeekNavigator';
import { fetchFreeSlots } from '../api/directoryApi';
import { ConfidentialityNote } from '../components/ConfidentialityNote';
import { FreeSlotsWeek } from '../components/FreeSlotsWeek';
import { PsychologistProfile } from '../components/PsychologistProfile';
import { usePsychologist } from '../hooks/usePsychologist';
import { bookableSlots, freeSlotNotice } from '../model/freeSlots';
import styles from './PsychologistPage.module.css';

interface Notice {
  id: number;
  text: string;
}

/** Figma B13 · Perfil del psicólogo con sus bloques libres de la semana (HU-FE-04). */
export function PsychologistPage() {
  const { psychologistId = '' } = useParams();
  const location = useLocation();
  const user = useCurrentUser();
  const now = useNow();
  const [weekStart, setWeek] = useWeekParam();
  const weekEnd = workweekEnd(weekStart);
  const profile = usePsychologist(psychologistId);
  const [notice, setNotice] = useState<Notice | null>(null);

  const week = useWeeklySlots({
    from: weekStart,
    to: weekEnd,
    psychologistId,
    load: (range, signal) => fetchFreeSlots(psychologistId, range, signal),
    onRealtimeEvent: (event: SlotEvent) => {
      const start = Date.parse(event.slot.startsAt);
      // Solo se avisa lo que cambia en la semana que se está mirando.
      if (start >= weekStart.getTime() && start < addDays(weekEnd, 1).getTime()) {
        setNotice((current) => ({ id: (current?.id ?? 0) + 1, text: freeSlotNotice(event) }));
      }
    },
  });

  const backTo = directoryReturnPath(location.state);
  const slots = bookableSlots(week.slots, now);
  const psychologist = profile.data;

  if (profile.error instanceof ApiError && profile.error.status === 404) {
    return (
      <div className={styles.notFound}>
        <h1 className={styles.notFoundTitle}>No encontramos a este psicólogo</h1>
        <p>Puede que ya no esté en el directorio.</p>
        <LinkButton to={backTo} variant="outline">
          Volver al directorio
        </LinkButton>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Ruta de navegación">
        <Link to={backTo} className={styles.backLink}>
          <ChevronLeftIcon />
          Bienestar
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{psychologist?.fullName ?? 'Perfil'}</span>
      </nav>

      {profile.status === 'error' && (
        <div className={styles.feedback} role="alert">
          <p>No pudimos cargar el perfil.</p>
          <Button variant="outline" onClick={profile.reload}>
            Reintentar
          </Button>
        </div>
      )}
      {psychologist === null ? (
        profile.status === 'loading' && (
          <div className={styles.profileSkeleton} aria-hidden="true" />
        )
      ) : (
        <PsychologistProfile psychologist={psychologist} now={now} />
      )}

      <div className={styles.layout}>
        <section
          className={styles.card}
          aria-label="Bloques libres"
          aria-busy={week.status === 'loading'}
        >
          <WeekNavigator weekStart={weekStart} weekEnd={weekEnd} onChange={setWeek} />

          {/* Región viva estable: el aviso cambia dentro sin que se pierda el anuncio. */}
          <div className={styles.noticeArea} role="status" aria-label="Avisos de bloques">
            <AnimatePresence mode="wait">
              {notice !== null && (
                <motion.div
                  key={notice.id}
                  className={styles.noticeFrame}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  <p className={styles.notice}>{notice.text}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {week.status === 'error' && (
            <div className={styles.feedback} role="alert">
              <p>No pudimos cargar los bloques libres.</p>
              <Button variant="outline" onClick={week.retry}>
                Reintentar
              </Button>
            </div>
          )}

          <FreeSlotsWeek
            days={workdaysOf(weekStart)}
            slots={slots}
            now={now}
            loading={week.status === 'loading'}
          />

          {week.status === 'ready' && slots.length === 0 && (
            <div className={styles.emptyWeek}>
              <p>No hay bloques libres esta semana.</p>
              <Button
                variant="outline"
                onClick={() => {
                  setWeek(addDays(weekStart, 7));
                }}
              >
                Ver semana siguiente
              </Button>
            </div>
          )}
        </section>

        {psychologist !== null && (
          <aside className={styles.side} aria-label="Privacidad">
            <ConfidentialityNote
              psychologistName={psychologist.fullName}
              organization={user.organization}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
