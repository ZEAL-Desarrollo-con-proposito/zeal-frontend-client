import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Link, useLocation, useParams } from 'react-router';
import { directoryReturnPath } from '@/app/paths';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { useWeeklySlots } from '@/features/availability/hooks/useWeeklySlots';
import type { Slot } from '@/features/availability/model/slot';
import { describeSlot } from '@/features/availability/model/slot';
import type { SlotEvent } from '@/features/availability/model/slotEvent';
import { BookingPanel } from '@/features/booking/components/BookingPanel';
import { useBookingFlow } from '@/features/booking/hooks/useBookingFlow';
import { ApiError } from '@/shared/api/errors';
import { useNow } from '@/shared/hooks/useNow';
import { useWeekParam } from '@/shared/hooks/useWeekParam';
import { addDays, workdaysOf, workweekEnd } from '@/shared/lib/dates';
import { Button } from '@/shared/ui/Button/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { LinkButton } from '@/shared/ui/Button/LinkButton';
import { ChevronLeftIcon } from '@/shared/ui/icons';
import { WeekNavigator } from '@/shared/ui/WeekNavigator/WeekNavigator';
import { fetchUpcomingSlots } from '../api/directoryApi';
import { ConfidentialityNote } from '../components/ConfidentialityNote';
import { WeekSlots } from '../components/WeekSlots';
import { PsychologistProfile } from '../components/PsychologistProfile';
import { usePsychologist } from '../hooks/usePsychologist';
import { freeSlotNotice, isBookable, upcomingSlots } from '../model/weekSlots';
import styles from './PsychologistPage.module.css';

interface Notice {
  id: number;
  text: string;
}

/** En pantallas angostas el resumen queda bajo la semana: se acerca al elegir un bloque. */
function revealPanel(panel: HTMLElement | null) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  panel?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
}

/** Figma B13 y B3 · Perfil del psicólogo, sus bloques libres y la reserva (HU-FE-04, HU-FE-05). */
export function PsychologistPage() {
  const { psychologistId = '' } = useParams();
  const location = useLocation();
  const user = useCurrentUser();
  const now = useNow();
  const [weekStart, setWeek] = useWeekParam();
  const weekEnd = workweekEnd(weekStart);
  const profile = usePsychologist(psychologistId);
  const [notice, setNotice] = useState<Notice | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const week = useWeeklySlots({
    from: weekStart,
    to: weekEnd,
    psychologistId,
    load: (range, signal) => fetchUpcomingSlots(psychologistId, range, signal),
    onRealtimeEvent: (event: SlotEvent) => {
      flow.slotChanged(event);
      const start = Date.parse(event.slot.startsAt);
      // Solo se avisa lo que cambia en la semana que se está mirando, y no la reserva propia.
      const inWeek = start >= weekStart.getTime() && start < addDays(weekEnd, 1).getTime();
      if (inWeek && !flow.isOwnBooking(event.slot.id)) {
        setNotice((current) => ({ id: (current?.id ?? 0) + 1, text: freeSlotNotice(event) }));
      }
    },
  });

  const flow = useBookingFlow({
    onBooked: (slot) => {
      week.addSlot({ ...slot, status: 'RESERVADA' });
    },
  });
  const target = flow.booking.target;

  function selectSlot(slot: Slot) {
    flow.select(slot);
    revealPanel(panelRef.current);
  }

  const backTo = directoryReturnPath(location.state);
  const slots = upcomingSlots(week.slots, now);
  const hasFreeSlots = slots.some(isBookable);
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
          aria-label="Bloques de la semana"
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
              <p>No pudimos cargar los bloques de la semana.</p>
              <Button variant="outline" onClick={week.retry}>
                Reintentar
              </Button>
            </div>
          )}

          <WeekSlots
            days={workdaysOf(weekStart)}
            slots={slots}
            now={now}
            loading={week.status === 'loading'}
            selectedId={flow.selected?.id ?? null}
            onSelect={selectSlot}
          />

          {week.status === 'ready' && !hasFreeSlots && (
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
          <aside className={styles.side} aria-label="Reserva y privacidad">
            <div ref={panelRef}>
              <BookingPanel
                psychologistName={psychologist.fullName}
                selected={flow.selected}
                booked={flow.booked}
                alert={flow.alert}
                onBook={flow.booking.request}
                onClear={flow.clear}
                onDismissBooked={flow.dismissBooked}
              />
            </div>
            <ConfidentialityNote
              psychologistName={psychologist.fullName}
              organization={user.organization}
            />
            <AnimatePresence>
              {target !== null && (
                <ConfirmDialog
                  key={target.id}
                  title="¿Agendar esta cita?"
                  description={`Sesión 1:1 con ${psychologist.fullName} el ${describeSlot(target)}.`}
                  confirmLabel="Confirmar cita"
                  pendingLabel="Agendando…"
                  confirmVariant="primary"
                  confirmDisabled={flow.booking.unavailable}
                  cancelLabel={flow.booking.unavailable ? 'Elegir otro bloque' : 'Cancelar'}
                  isPending={flow.booking.isPending}
                  error={flow.booking.error}
                  onCancel={flow.booking.cancel}
                  onConfirm={() => {
                    void flow.booking.confirm(target);
                  }}
                />
              )}
            </AnimatePresence>
          </aside>
        )}
      </div>
    </div>
  );
}
