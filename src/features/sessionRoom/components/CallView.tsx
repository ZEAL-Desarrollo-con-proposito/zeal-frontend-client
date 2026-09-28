import { AnimatePresence, motion } from 'motion/react';
import type { CallSnapshot, CallStatus } from '../call/callSession';
import type { MediaState } from '../model/roomEvent';
import { CallControls } from './CallControls';
import { VideoTile } from './VideoTile';
import styles from './CallView.module.css';

interface CallViewProps {
  /** La otra persona de la sesión. */
  participant: string;
  selfName: string;
  call: CallSnapshot;
  localStream: MediaStream;
  media: MediaState;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onLeave: () => void;
}

function statusText(status: CallStatus, participant: string): string {
  switch (status) {
    case 'waiting':
      return `Esperando a que ${participant} entre a la sala…`;
    case 'connecting':
      return 'Conectando el video…';
    case 'reconnecting':
      return 'Se perdió la conexión. Reconectando…';
    case 'connected':
      return `Conectado con ${participant}`;
  }
}

/** Figma C2 · Sesión 1:1 en curso: video de la otra persona en grande y el propio en miniatura. */
export function CallView({
  participant,
  selfName,
  call,
  localStream,
  media,
  onToggleAudio,
  onToggleVideo,
  onLeave,
}: Readonly<CallViewProps>) {
  const connected = call.status === 'connected';

  return (
    <motion.section
      className={styles.call}
      aria-label="Videollamada"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className={styles.stage}>
        <VideoTile
          stream={call.remoteStream}
          name={participant}
          label={participant}
          tone="sage"
          media={call.remoteMedia}
        />
        <motion.div
          className={styles.pip}
          initial={{ opacity: 0, x: 24, y: -12 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.1 }}
        >
          <VideoTile
            stream={localStream}
            name={selfName}
            label="Tú"
            tone="teal"
            media={media}
            self
          />
        </motion.div>
        {/* Región viva estable: anuncia cuando la otra persona entra, se conecta o se pierde. */}
        <div className={styles.status} role="status">
          <AnimatePresence mode="wait">
            <motion.p
              key={call.status}
              className={connected ? 'visually-hidden' : styles.statusText}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {statusText(call.status, participant)}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
      <p className={styles.privacy}>No se graba · sin transcripción automática</p>
      <CallControls
        media={media}
        onToggleAudio={onToggleAudio}
        onToggleVideo={onToggleVideo}
        onLeave={onLeave}
      />
    </motion.section>
  );
}
