import type { ReactNode, Ref } from 'react';
import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/shared/ui/Button/Button';
import { CameraIcon, CameraOffIcon, MicIcon, MicOffIcon, PhoneOffIcon } from '@/shared/ui/icons';
import type { MediaState } from '../model/roomEvent';
import styles from './CallControls.module.css';

interface CallControlsProps {
  media: MediaState;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onLeave: () => void;
}

/** Figma C2 · barra de la llamada: micrófono, cámara y salir de la sala. */
export function CallControls({
  media,
  onToggleAudio,
  onToggleVideo,
  onLeave,
}: Readonly<CallControlsProps>) {
  const firstControl = useRef<HTMLButtonElement>(null);

  // Al entrar a la llamada el botón que se pulsó desaparece: el foco pasa a los controles.
  useEffect(() => {
    firstControl.current?.focus();
  }, []);

  return (
    <motion.div
      role="group"
      aria-label="Controles de la llamada"
      className={styles.bar}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut', delay: 0.15 }}
    >
      <ToggleButton
        ref={firstControl}
        label="Silenciar micrófono"
        off={!media.audio}
        onClick={onToggleAudio}
        icon={media.audio ? <MicIcon /> : <MicOffIcon />}
      />
      <ToggleButton
        label="Apagar cámara"
        off={!media.video}
        onClick={onToggleVideo}
        icon={media.video ? <CameraIcon /> : <CameraOffIcon />}
      />
      <Button variant="danger" className={styles.leave} onClick={onLeave}>
        <PhoneOffIcon />
        Salir de la sala
      </Button>
    </motion.div>
  );
}

interface ToggleButtonProps {
  label: string;
  /** Presionado: el micrófono o la cámara están apagados. */
  off: boolean;
  onClick: () => void;
  icon: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

function ToggleButton({ label, off, onClick, icon, ref }: Readonly<ToggleButtonProps>) {
  return (
    <motion.button
      ref={ref}
      type="button"
      className={styles.toggle}
      aria-label={label}
      aria-pressed={off}
      title={label}
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={String(off)}
          className={styles.icon}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.15 }}
        >
          {icon}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
