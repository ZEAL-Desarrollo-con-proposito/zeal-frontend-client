import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { EMPLOYEE_PATHS } from '@/app/paths';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { useNow } from '@/shared/hooks/useNow';
import { Button } from '@/shared/ui/Button/Button';
import { LinkButton } from '@/shared/ui/Button/LinkButton';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { AppointmentList } from '../components/AppointmentList';
import type { AppointmentTab } from '../components/AppointmentTabs';
import { AppointmentTabs } from '../components/AppointmentTabs';
import { NextAppointmentCard } from '../components/NextAppointmentCard';
import { NoAppointments } from '../components/NoAppointments';
import type { AppointmentView } from '../hooks/useAppointmentsView';
import { APPOINTMENT_VIEWS, useAppointmentsView } from '../hooks/useAppointmentsView';
import { useCancelAppointment } from '../hooks/useCancelAppointment';
import { useMyAppointments } from '../hooks/useMyAppointments';
import type { Appointment } from '../model/appointment';
import { appointmentWhen, groupAppointments } from '../model/appointment';
import styles from './AppointmentsPage.module.css';

const TAB_LABELS: Record<AppointmentView, string> = {
  proximas: 'Próximas',
  historial: 'Historial',
  canceladas: 'Canceladas',
};

const EMPTY_TAB: Record<AppointmentView, string> = {
  proximas: 'No tienes citas próximas.',
  historial: 'Aún no tienes sesiones finalizadas.',
  canceladas: 'No tienes citas canceladas.',
};

const PLACEHOLDERS = ['uno', 'dos', 'tres'] as const;

interface ViewPanelProps {
  view: AppointmentView;
  appointments: readonly Appointment[];
  now: number;
  onCancel: (appointment: Appointment) => void;
}

/** Contenido de una pestaña: en Próximas, la más cercana va destacada (Figma B9). */
function ViewPanel({ view, appointments, now, onCancel }: Readonly<ViewPanelProps>) {
  const [next, ...later] = appointments;
  if (next === undefined) {
    return (
      <div className={styles.emptyTab}>
        <p>{EMPTY_TAB[view]}</p>
        {view === 'proximas' && (
          <LinkButton to={EMPLOYEE_PATHS.wellbeing} variant="outline">
            Reservar sesión
          </LinkButton>
        )}
      </div>
    );
  }
  if (view !== 'proximas') {
    return <AppointmentList appointments={appointments} now={now} label={TAB_LABELS[view]} />;
  }
  return (
    <>
      <NextAppointmentCard
        appointment={next}
        now={now}
        onCancel={() => {
          onCancel(next);
        }}
      />
      {later.length > 0 && (
        <section className={styles.later} aria-labelledby="siguientes-citas">
          <h2 id="siguientes-citas" className={styles.sectionTitle}>
            Siguientes citas
          </h2>
          <AppointmentList
            appointments={later}
            now={now}
            label="Siguientes citas"
            onCancel={onCancel}
          />
        </section>
      )}
    </>
  );
}

/** Figma B9 · Mis citas — agenda del empleado (HU-FE-05). */
export function AppointmentsPage() {
  const user = useCurrentUser();
  const now = useNow();
  const { status, appointments, reload, applyCancellation } = useMyAppointments();
  const [view, setView] = useAppointmentsView();
  const [announcement, setAnnouncement] = useState('');
  const panelId = useId();
  const tabPrefix = useId();

  const cancellation = useCancelAppointment({
    onCancelled: (cancelled) => {
      applyCancellation(cancelled);
      setAnnouncement(`Cancelaste tu cita con ${cancelled.psychologist.fullName}.`);
    },
  });
  const target = cancellation.target;

  const groups = groupAppointments(appointments);
  const byView: Record<AppointmentView, Appointment[]> = {
    proximas: groups.upcoming,
    historial: groups.history,
    canceladas: groups.cancelled,
  };
  const tabs: AppointmentTab[] = APPOINTMENT_VIEWS.map((tab) => ({
    view: tab,
    label: TAB_LABELS[tab],
    count: byView[tab].length,
  }));
  const tabId = (tab: AppointmentView) => `${tabPrefix}-${tab}`;
  const loaded = appointments.length > 0;

  return (
    <div className={styles.page}>
      <motion.header
        className={styles.head}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <div className={styles.headText}>
          <h1 className={styles.title}>Mis citas</h1>
          <p className={styles.subtitle}>
            Tu historial es privado: ni tu empresa ni otro profesional pueden verlo.
          </p>
        </div>
        <LinkButton to={EMPLOYEE_PATHS.wellbeing}>Reservar sesión</LinkButton>
      </motion.header>

      <p className={styles.announcement} role="status" aria-label="Avisos de tus citas">
        {announcement}
      </p>

      {status === 'error' && (
        <div className={styles.feedback} role="alert">
          <p>No pudimos cargar tus citas.</p>
          <Button variant="outline" onClick={reload}>
            Reintentar
          </Button>
        </div>
      )}

      {status === 'loading' && !loaded && (
        <ul className={styles.skeleton} aria-label="Cargando tus citas" aria-busy="true">
          {PLACEHOLDERS.map((placeholder) => (
            <li key={placeholder} className={styles.skeletonRow} />
          ))}
        </ul>
      )}

      {status === 'ready' && !loaded && <NoAppointments organization={user.organization} />}

      {loaded && (
        <section className={styles.content} aria-label="Tus citas">
          <AppointmentTabs
            tabs={tabs}
            selected={view}
            onSelect={setView}
            panelId={panelId}
            tabId={tabId}
          />
          <motion.div
            key={view}
            id={panelId}
            role="tabpanel"
            aria-labelledby={tabId(view)}
            className={styles.panel}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <ViewPanel
              view={view}
              appointments={byView[view]}
              now={now}
              onCancel={cancellation.request}
            />
          </motion.div>
        </section>
      )}

      <AnimatePresence>
        {target !== null && (
          <ConfirmDialog
            key={target.id}
            title="¿Cancelar esta cita?"
            description={`Tu cita con ${target.psychologist.fullName} el ${appointmentWhen(target, now)} se cancelará y el bloque quedará libre para otras personas.`}
            confirmLabel="Cancelar cita"
            pendingLabel="Cancelando…"
            cancelLabel="Volver"
            isPending={cancellation.isPending}
            error={cancellation.error}
            onCancel={cancellation.cancel}
            onConfirm={() => {
              void cancellation.confirm(target);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}