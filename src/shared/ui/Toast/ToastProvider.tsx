import type { ReactNode } from 'react';
import { useCallback, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import type { Toast, ToastInput } from './toast';
import { enqueueToast, ToastContext } from './toast';
import { ToastItem } from './ToastItem';
import styles from './Toast.module.css';

/**
 * Avisos emergentes (Figma E1, esquina superior derecha). La región vive siempre en el documento
 * para que los lectores de pantalla anuncien cada aviso nuevo, sin robar el foco.
 */
export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((input: ToastInput) => {
    nextId.current += 1;
    const toast: Toast = { tone: 'info', ...input, id: nextId.current };
    setToasts((current) => enqueueToast(current, toast));
  }, []);

  function dismiss(id: number) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  return (
    <ToastContext value={showToast}>
      {children}
      {createPortal(
        <section className={styles.viewport} aria-label="Avisos" aria-live="polite">
          <ol className={styles.list}>
            <AnimatePresence initial={false}>
              {toasts.map((toast) => (
                <ToastItem
                  key={toast.id}
                  toast={toast}
                  onDismiss={() => {
                    dismiss(toast.id);
                  }}
                />
              ))}
            </AnimatePresence>
          </ol>
        </section>,
        document.body,
      )}
    </ToastContext>
  );
}
