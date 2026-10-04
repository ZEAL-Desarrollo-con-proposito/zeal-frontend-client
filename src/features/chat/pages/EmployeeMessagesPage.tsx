import { EMPLOYEE_PATHS } from '@/app/paths';
import { useMyAppointments } from '@/features/appointments/hooks/useMyAppointments';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { useNow } from '@/shared/hooks/useNow';
import { Button } from '@/shared/ui/Button/Button';
import { LinkButton } from '@/shared/ui/Button/LinkButton';
import { ChatConversation } from '../components/ChatConversation';
import { conversationId } from '../model/chatMessage';
import { psychologistPeer } from '../model/chatPeer';
import styles from './MessagesPage.module.css';

/** Figma B10 · Mensajes — conversación del empleado con su psicólogo (HU-FE-09). */
export function EmployeeMessagesPage() {
  const user = useCurrentUser();
  const now = useNow();
  const { status, appointments, reload } = useMyAppointments();
  const peer = psychologistPeer(appointments, now);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Mensajes</h1>
        <p className={styles.subtitle}>
          Tus conversaciones son privadas y cifradas de extremo a extremo.
        </p>
      </header>

      {status === 'loading' && (
        <div className={styles.feedback} aria-busy="true">
          Cargando…
        </div>
      )}

      {status === 'error' && (
        <div className={styles.feedback} role="alert">
          <p>No pudimos cargar tus citas.</p>
          <Button variant="outline" onClick={reload}>
            Reintentar
          </Button>
        </div>
      )}

      {status === 'ready' && peer === null && (
        <div className={styles.feedback}>
          <p>Aún no tienes una conversación abierta.</p>
          <p>Reserva una cita para poder escribirle a tu psicólogo.</p>
          <LinkButton to={EMPLOYEE_PATHS.wellbeing} variant="outline">
            Ir a Bienestar
          </LinkButton>
        </div>
      )}

      {status === 'ready' && peer !== null && (
        <div className={styles.card}>
          <ChatConversation
            conversationId={conversationId(user.id, peer.id)}
            peer={peer}
            currentUserId={user.id}
          />
        </div>
      )}
    </div>
  );
}
