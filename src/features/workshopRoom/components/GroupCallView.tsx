import { useState } from 'react';
import { motion } from 'motion/react';
import { CallControls } from '@/features/videoCall/components/CallControls';
import { VideoTile } from '@/features/videoCall/components/VideoTile';
import type { MediaErrorReason } from '@/features/videoCall/call/mediaError';
import { MEDIA_ERROR_MESSAGES } from '@/features/videoCall/call/mediaError';
import type { MediaState } from '@/features/videoCall/call/videoCall';
import { AlertIcon } from '@/shared/ui/icons';
import type { VideoCallSnapshot, CallChatMessage } from '@/features/videoCall/call/videoCall';
import { participantLabel } from '@/features/videoCall/call/videoCall';
import { GroupChatPanel } from './GroupChatPanel';
import styles from './GroupCallView.module.css';

interface GroupCallViewProps {
  snapshot: VideoCallSnapshot;
  media: MediaState;
  mediaError: MediaErrorReason | null;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onLeave: () => void;
  messages: readonly CallChatMessage[];
  chatFailed: boolean;
  onSendMessage: (text: string) => void;
}

function countLabel(count: number): string {
  return count === 1 ? '1 persona en la sala' : `${String(count)} personas en la sala`;
}

/** Taller en vivo: una cuadrícula con el video de cada persona y la barra de controles. */
export function GroupCallView({
  snapshot,
  media,
  mediaError,
  onToggleAudio,
  onToggleVideo,
  onLeave,
  messages,
  chatFailed,
  onSendMessage,
}: Readonly<GroupCallViewProps>) {
  const { participants, status } = snapshot;
  const [chatOpen, setChatOpen] = useState(false);
  // Mensajes de otras personas ya vistos: los que llegan con el chat cerrado se cuentan.
  const fromOthers = messages.filter(({ self }) => !self).length;
  const [seen, setSeen] = useState(0);
  const unread = chatOpen ? 0 : fromOthers - seen;
  const error = mediaError === null ? null : MEDIA_ERROR_MESSAGES[mediaError];

  return (
    <motion.section
      className={styles.call}
      aria-label="Taller en vivo"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className={styles.bar}>
        <p className={styles.count} role="status">
          {status === 'reconnecting'
            ? 'Se perdió la conexión. Reconectando…'
            : countLabel(participants.length)}
        </p>
        <p className={styles.privacy}>No se graba · sin transcripción automática</p>
      </div>
      {error !== null && (
        <div role="alert" className={styles.alert}>
          <AlertIcon />
          <p>
            <strong>{error.title}.</strong> {error.detail}
          </p>
        </div>
      )}
      <div className={styles.content}>
        <ul
          className={styles.grid}
          aria-label="Participantes"
          data-count={Math.min(participants.length, 9)}
        >
          {participants.map((participant) => (
            <li
              key={participant.id}
              className={styles.cell}
              data-speaking={participant.speaking}
              data-host={participant.host}
            >
              <VideoTile
                stream={participant.stream}
                name={participant.name}
                label={participantLabel(participant)}
                tone={participant.host ? 'sage' : 'teal'}
                media={participant.self ? media : participant.media}
                self={participant.self}
              />
            </li>
          ))}
        </ul>
        {chatOpen && (
          <aside className={styles.aside}>
            <GroupChatPanel messages={messages} failed={chatFailed} onSend={onSendMessage} />
          </aside>
        )}
      </div>
      <CallControls
        media={media}
        onToggleAudio={onToggleAudio}
        onToggleVideo={onToggleVideo}
        onLeave={onLeave}
        chat={{
          open: chatOpen,
          unread,
          onToggle: () => {
            setSeen(fromOthers);
            setChatOpen((open) => !open);
          },
        }}
      />
    </motion.section>
  );
}
