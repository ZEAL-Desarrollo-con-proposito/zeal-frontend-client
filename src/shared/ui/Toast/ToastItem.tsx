import type { ComponentType, Ref } from 'react';
import { useEffect, useEffectEvent, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { AlertIcon, BellIcon, CheckIcon, CloseIcon } from '../icons';
import type { Toast, ToastTone } from './toast';
import { TOAST_DURATION_MS } from './toast';
import styles from './Toast.module.css';

const ICONS: Record<ToastTone, ComponentType> = {
  success: CheckIcon,
  info: BellIcon,
  warning: AlertIcon,
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
  ref?: Ref<HTMLLIElement>;
}

/**
 * Un aviso: se cierra solo a los pocos segundos, pero el tiempo se detiene mientras el puntero o
 * el foco están encima (quien lee o usa el teclado no lo pierde, WCAG 2.2.1).
 */
export function ToastItem({ toast, onDismiss, ref }: Readonly<ToastItemProps>) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  const dismiss = useEffectEvent(onDismiss);
  const Icon = ICONS[toast.tone];

  useEffect(() => {
    if (paused) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      dismiss();
    }, TOAST_DURATION_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [paused]);

  return (
    <motion.li
      ref={ref}
      layout
      className={styles.toast}
      data-tone={toast.tone}
      initial={{ opacity: 0, x: 32, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 32, transition: { duration: 0.18, ease: 'easeIn' } }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
      }}
      onFocus={() => {
        setFocused(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false);
        }
      }}
    >
      <span className={styles.icon} aria-hidden="true">
        <Icon />
      </span>
      <div className={styles.body}>
        <p className={styles.title}>{toast.title}</p>
        {toast.message !== undefined && <p className={styles.message}>{toast.message}</p>}
        <div className={styles.footer}>
          {toast.action !== undefined && (
            <Link to={toast.action.to} className={styles.action} onClick={onDismiss}>
              {toast.action.label}
            </Link>
          )}
          <span className={styles.time}>Ahora</span>
        </div>
      </div>
      <button type="button" className={styles.close} aria-label="Cerrar aviso" onClick={onDismiss}>
        <CloseIcon />
      </button>
    </motion.li>
  );
}
