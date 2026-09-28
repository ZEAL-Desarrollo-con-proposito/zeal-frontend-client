import { useCallback, useId } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cx } from '@/shared/lib/cx';
import type { AvatarTone } from '@/shared/ui/Avatar/Avatar';
import { Avatar } from '@/shared/ui/Avatar/Avatar';
import { MicOffIcon } from '@/shared/ui/icons';
import type { MediaState } from '../model/roomEvent';
import styles from './VideoTile.module.css';

interface VideoTileProps {
  stream: MediaStream | null;
  /** Quién aparece: sus iniciales reemplazan el video cuando la cámara está apagada. */
  name: string;
  label: string;
  tone: AvatarTone;
  media: MediaState;
  /** Video propio: se ve en espejo y su audio no se reproduce (evita el eco). */
  self?: boolean;
}

/**
 * Video de una persona en la llamada. El elemento de video siempre está montado: aunque la
 * cámara esté apagada, por él sigue llegando el audio.
 */
export function VideoTile({
  stream,
  name,
  label,
  tone,
  media,
  self = false,
}: Readonly<VideoTileProps>) {
  const captionId = useId();
  const showVideo = stream !== null && media.video;
  // Solo cambia con el stream: reasignar el mismo reiniciaría la reproducción.
  const attachStream = useCallback(
    (video: HTMLVideoElement | null) => {
      if (video !== null) {
        video.srcObject = stream;
      }
    },
    [stream],
  );

  return (
    <figure className={cx(styles.tile, self && styles.self)} aria-labelledby={captionId}>
      {/* Videollamada en vivo: no existe una pista de subtítulos que ofrecer. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={attachStream}
        className={styles.video}
        data-visible={showVideo}
        autoPlay
        playsInline
        muted={self}
      />
      <AnimatePresence>
        {!showVideo && (
          <motion.div
            key="iniciales"
            className={styles.placeholder}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Avatar name={name} tone={tone} size="xl" />
          </motion.div>
        )}
      </AnimatePresence>
      <figcaption id={captionId} className={styles.caption}>
        {label}
        {!media.audio && (
          <span className={styles.muted}>
            <MicOffIcon />
            <span className="visually-hidden">, micrófono silenciado</span>
          </span>
        )}
        {!media.video && <span className="visually-hidden">, cámara apagada</span>}
      </figcaption>
    </figure>
  );
}
