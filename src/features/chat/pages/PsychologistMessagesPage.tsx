import { PSYCHOLOGIST_PATHS } from '@/app/paths';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { useAgenda } from '@/features/agenda/hooks/useAgenda';
import { useNow } from '@/shared/hooks/useNow';
import { useWeekParam } from '@/shared/hooks/useWeekParam';
import { addDays, workweekEnd } from '@/shared/lib/dates';
import { Button } from '@/shared/ui/Button/Button';
import { LinkButton } from '@/shared/ui/Button/LinkButton';
import { ChatConversation } from '../components/ChatConversation';
import { conversationId } from '../model/chatMessage';
import { employeePeer } from '../model/chatPeer';
import styles from './MessagesPage.module.css';

/**conversación del psicólogo con su paciente */
export function PsychologistMessagesPage() {
  const user = useCurrentUser();
  const now = useNow();
  const [weekStart] = useWeekParam();
  // Semana actual + la siguiente, para no perder reservas de los próximos días.
  const weekEnd = addDays(workweekEnd(weekStart), 7);
  const { status, reservations, reload } = useAgenda(weekStart, weekEnd, user.id);
  const peer = employeePeer(reservations, now);

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
          <p>No pudimos cargar tu agenda.</p>
          <Button variant="outline" onClick={reload}>
            Reintentar
          </Button>
        </div>
      )}

      {status === 'ready' && peer === null && (
        <div className={styles.feedback}>
          <p>Aún no tienes una conversación abierta.</p>
          <p>Cuando alguien reserve contigo, podrás escribirle por aquí.</p>
          <LinkButton to={PSYCHOLOGIST_PATHS.agenda} variant="outline">
            Ir a mi agenda
          </LinkButton>
        </div>
      )}

      {status === 'ready' && peer !== null && (
        <div className={styles.card}>
          <ChatConversation
            conversationId={conversationId(peer.id, user.id)}
            peer={peer}
            currentUserId={user.id}
          />
        </div>
      )}
    </div>
  );
}
