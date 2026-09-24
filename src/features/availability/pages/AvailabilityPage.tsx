import { AnimatePresence } from 'motion/react';
import { useRef, useState } from 'react';
import { useWeekParam } from '@/shared/hooks/useWeekParam';
import { addDays } from '@/shared/lib/dates';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { WeekNavigator } from '@/shared/ui/WeekNavigator/WeekNavigator';
import { CreateSlotForm } from '../components/CreateSlotForm';
import { WeekCalendar } from '../components/WeekCalendar';
import { useCreateSlotForm } from '../hooks/useCreateSlotForm';
import { useDeleteSlot } from '../hooks/useDeleteSlot';
import { useWeeklySlots } from '../hooks/useWeeklySlots';
import { WORKDAYS_PER_WEEK, workdaysOf } from '../model/calendar';
import { describeSlot } from '../model/slot';
import styles from './AvailabilityPage.module.css';

/** Figma C8 · Disponibilidad — bloques de atención del psicólogo (HU-FE-02). */
export function AvailabilityPage() {
  const [weekStart, setWeek] = useWeekParam();
  const weekEnd = addDays(weekStart, WORKDAYS_PER_WEEK - 1);
  const days = workdaysOf(weekStart);
  const { status, slots, retry, addSlot, removeSlot } = useWeeklySlots(weekStart, weekEnd);
  const [announcement, setAnnouncement] = useState('');
  const daySelectRef = useRef<HTMLSelectElement>(null);

  const form = useCreateSlotForm(weekStart, (slot) => {
    addSlot(slot);
    setAnnouncement(`Abriste la franja del ${describeSlot(slot)}.`);
  });

  const deletion = useDeleteSlot({
    onDeleted: (slot, outcome) => {
      removeSlot(slot.id);
      setAnnouncement(
        outcome === 'deleted'
          ? `Eliminaste la franja del ${describeSlot(slot)}.`
          : 'Esa franja ya había sido eliminada.',
      );
    },
    onConflict: retry,
  });

  const target = deletion.target;
  const available = slots.filter((slot) => slot.status === 'DISPONIBLE').length;
  const reserved = slots.length - available;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Mi disponibilidad</h1>
        <p className={styles.subtitle}>
          Las franjas que abras aquí son las que tus pacientes pueden reservar.
        </p>
      </header>

      <p className={styles.announcement} role="status">
        {announcement}
      </p>

      <div className={styles.layout}>
        <section className={styles.calendarCard} aria-label="Calendario semanal">
          <WeekNavigator weekStart={weekStart} weekEnd={weekEnd} onChange={setWeek} />
          <WeekCalendar
            days={days}
            slots={slots}
            status={status}
            onRetry={retry}
            onSelectHour={(day, hour) => {
              form.prefill(day, hour);
              daySelectRef.current?.focus();
            }}
            onSelectSlot={deletion.request}
          />
        </section>

        <aside className={styles.side} aria-label="Gestión de franjas">
          <CreateSlotForm form={form} days={days} daySelectRef={daySelectRef} />
          <section className={styles.card} aria-labelledby="resumen-semana">
            <h2 id="resumen-semana" className={styles.cardTitle}>
              Esta semana
            </h2>
            <dl className={styles.summary}>
              <div>
                <dt>Abiertas</dt>
                <dd>{available}</dd>
              </div>
              <div>
                <dt>Reservadas</dt>
                <dd>{reserved}</dd>
              </div>
            </dl>
          </section>
          <section className={styles.note} aria-labelledby="nota-tiempo-real">
            <h2 id="nota-tiempo-real" className={styles.noteTitle}>
              Al liberar una franja
            </h2>
            <p>
              ZEAL avisa en tiempo real a los pacientes con cita posterior ese mismo día. El primero
              en confirmar toma el cupo.
            </p>
          </section>
        </aside>
      </div>

      <AnimatePresence>
        {target !== null && (
          <ConfirmDialog
            key={target.id}
            title="¿Eliminar esta franja?"
            description={`La franja del ${describeSlot(target)} dejará de estar disponible para tus pacientes.`}
            confirmLabel="Eliminar franja"
            pendingLabel="Eliminando…"
            isPending={deletion.isPending}
            error={deletion.error}
            onCancel={deletion.cancel}
            onConfirm={() => {
              void deletion.confirm(target);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
