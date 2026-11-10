import type { ReactNode } from 'react';
import { useState } from 'react';
import { motion } from 'motion/react';
import type { MediaErrorReason } from '@/features/videoCall/call/mediaError';
import { MEDIA_ERROR_MESSAGES } from '@/features/videoCall/call/mediaError';
import type { MediaState, VideoCallSnapshot } from '@/features/videoCall/call/videoCall';
import type { CallChatControl } from '@/features/videoCall/components/CallControls';
import { CallControls } from '@/features/videoCall/components/CallControls';
import { VideoTile } from '@/features/videoCall/components/VideoTile';
import { cx } from '@/shared/lib/cx';
import { AlertIcon } from '@/shared/ui/icons';
import styles from './CallView.module.css';

interface CallViewProps {
  /** La otra persona de la sesión. */
  participant: string;
  selfName: string;
  snapshot: VideoCallSnapshot;
  media: MediaState;
  /** El navegador no dejó encender la cámara o el micrófono: se explica cómo resolverlo. */
  mediaError: MediaErrorReason | null;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onLeave: () => void;
  chat: CallChatControl;
  /** Conversación de la sesión, al lado del video mientras el chat está abierto. */
  chatPanel: ReactNode;
}

type CallState = 'waiting' | 'left' | 'reconnecting' | 'connected';

function statusText(state: CallState, participant: string): string {
  switch (state) {
    case 'waiting':
      return `Esperando a que ${participant} entre a la sala…`;
    case 'left':
      return `${participant} salió de la sala. Puedes esperar a que vuelva o salir tú también.`;
    case 'reconnecting':
      return 'Se perdió la conexión. Reconectando…';
    case 'connected':
      return `Conectado con ${participant}`;
  }
}

const NO_MEDIA: MediaState = { audio: false, video: false };

/** Figma C2 · Sesión 1:1 en curso: video de la otra persona en grande y el propio en miniatura. */
export function CallView({
  participant,
  selfName,
  snapshot,
  media,
  mediaError,
  onToggleAudio,
  onToggleVideo,
  onLeave,
  chat,
  chatPanel,
}: Readonly<CallViewProps>) {
  const self = snapshot.participants.find((person) => person.self) ?? null;
  const other = snapshot.participants.find((person) => !person.self) ?? null;
  // Si la otra persona ya estuvo, su ausencia es "salió" y no "aún no llega".
  const [met, setMet] = useState(false);
  if (other !== null && !met) {
    setMet(true);
  }
  let state: CallState = 'connected';
  if (snapshot.status === 'reconnecting') {
    state = 'reconnecting';
  } else if (other === null) {
    state = met ? 'left' : 'waiting';
  }
  const error = mediaError === null ? null : MEDIA_ERROR_MESSAGES[mediaError];

  return (
    <motion.section
      className={styles.call}
      aria-label="Videollamada"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {error !== null && (
        <div role="alert" className={styles.alert}>
          <AlertIcon />
          <p>
            <strong>{error.title}.</strong> {error.detail}
          </p>
        </div>
      )}
      <div className={styles.content}>
        <div className={styles.stage}>
          <VideoTile
            stream={other?.stream ?? null}
            name={participant}
            label={participant}
            tone="sage"
            media={other?.media ?? NO_MEDIA}
          />
          <motion.div
            className={styles.pip}
            initial={{ opacity: 0, x: 24, y: -12 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.1 }}
          >
            <VideoTile
              stream={self?.stream ?? null}
              name={selfName}
              label="Tú"
              tone="teal"
              media={media}
              self
            />
          </motion.div>
          {/* Región viva estable: anuncia cuando la otra persona entra, se pierde la conexión o sale.
              El texto nuevo reemplaza al anterior al instante y solo anima su entrada: la región
              siempre dice el estado actual, sin esperar a que termine la salida del anterior. */}
          <div className={styles.status} role="status">
            <motion.p
              key={state}
              className={cx(
                state === 'connected' && 'visually-hidden',
                state !== 'connected' && styles.statusText,
                state === 'left' && styles.statusLeft,
              )}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {statusText(state, participant)}
            </motion.p>
          </div>
        </div>
        {chat.open && (
          <aside className={styles.aside} aria-label="Chat de la sesión">
            {chatPanel}
          </aside>
        )}
      </div>
      <p className={styles.privacy}>No se graba · sin transcripción automática</p>
      <CallControls
        media={media}
        onToggleAudio={onToggleAudio}
        onToggleVideo={onToggleVideo}
        onLeave={onLeave}
        chat={chat}
      />
    </motion.section>
  );
}
