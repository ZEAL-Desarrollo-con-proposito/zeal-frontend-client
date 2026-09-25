import type { KeyboardEvent } from 'react';
import { motion } from 'motion/react';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../Button/Button';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  isPending: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmación de acciones destructivas: foco atrapado entre sus botones, Escape cancela y al
 * cerrar el foco vuelve a quien lo abrió. Se monta en <body> para no depender de transformaciones
 * de sus ancestros. Quien lo usa lo envuelve en <AnimatePresence> para animar su salida.
 */
export function ConfirmDialog(props: Readonly<ConfirmDialogProps>) {
  return createPortal(<DialogContent {...props} />, document.body);
}

function DialogContent({
  title,
  description,
  confirmLabel,
  pendingLabel,
  isPending,
  error,
  onConfirm,
  onCancel,
}: Readonly<ConfirmDialogProps>) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // activeElement siempre existe mientras hay documento (como mínimo, <body>).
    const opener = document.activeElement as HTMLElement;
    cancelRef.current?.focus();
    return () => {
      opener.focus();
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !isPending) {
      onCancel();
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      const target = document.activeElement === cancelRef.current ? confirmRef : cancelRef;
      target.current?.focus();
    }
  }

  return (
    <>
      <motion.div
        className={styles.backdrop}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={styles.dialog}
        onKeyDown={handleKeyDown}
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <p id={descriptionId} className={styles.description}>
          {description}
        </p>
        {error !== null && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <Button ref={cancelRef} variant="outline" onClick={onCancel} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            ref={confirmRef}
            variant="danger"
            onClick={onConfirm}
            disabled={isPending}
            aria-busy={isPending}
          >
            {isPending ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </motion.div>
    </>
  );
}
