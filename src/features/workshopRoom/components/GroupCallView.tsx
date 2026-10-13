import { motion } from 'motion/react';
import { CallControls } from '@/features/sessionRoom/components/CallControls';
import { VideoTile } from '@/features/sessionRoom/components/VideoTile';
import type { MediaErrorReason } from '@/features/sessionRoom/call/localMedia';
import { MEDIA_ERROR_MESSAGES } from '@/features/sessionRoom/call/localMedia';
import type { MediaState } from '@/features/sessionRoom/model/roomEvent';
import { AlertIcon } from '@/shared/ui/icons';
import type { GroupCallSnapshot } from '../call/groupCall';
import { participantLabel } from '../call/groupCall';
import styles from './GroupCallView.module.css';

interface GroupCallViewProps {
  snapshot: GroupCallSnapshot;
  media: MediaState;
  mediaError: MediaErrorReason | null;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onLeave: () => void;
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
}: Readonly<GroupCallViewProps>) {
  const { participants, status } = snapshot;
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
      <CallControls
        media={media}
        onToggleAudio={onToggleAudio}
        onToggleVideo={onToggleVideo}
        onLeave={onLeave}
      />
    </motion.section>
  );
}
