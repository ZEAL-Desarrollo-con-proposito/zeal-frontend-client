import { useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Badge } from '@/shared/ui/Badge/Badge';
import { Button } from '@/shared/ui/Button/Button';
import type { Application } from '../model/application';
import { applicationBadge } from '../model/application';
import type { Spots } from '../model/project';
import { availableSpots } from '../model/project';
import styles from './ApplyButton.module.css';

interface ApplyButtonProps {
  title: string;
  spots: Spots;
  /** La convocatoria ya no recibe postulaciones. */
  closed: boolean;
  /** La postulación de la persona a esta convocatoria, si ya se postuló. */
  application: Application | null;
  /** El servidor está procesando la postulación. */
  sending: boolean;
  onApply: () => void;
}

type ApplyState = 'applied' | 'closed' | 'full' | 'open';

function applyState({ closed, spots, application }: ApplyButtonProps): ApplyState {
  if (application !== null) {
    return 'applied';
  }
  if (closed) {
    return 'closed';
  }
  return availableSpots(spots) === 0 ? 'full' : 'open';
}

/**
 * Postularse según lo que informó el servidor: con cupos, "Postularme" (mientras procesa muestra
 * que envía y no admite otro clic, sin perder el foco); al llegar a cero, "Cupos agotados"; ya
 * postulada, el resultado: aceptada o lista de espera.
 */
export function ApplyButton(props: Readonly<ApplyButtonProps>) {
  const { title, application, sending, onApply } = props;
  const state = applyState(props);
  const wasSending = useRef(false);
  const focusResult = useRef(false);

  // El botón que se pulsó desaparece con el resultado: el foco pasa al resultado, no se pierde.
  useEffect(() => {
    if (state === 'applied' && wasSending.current) {
      focusResult.current = true;
    }
    wasSending.current = sending;
  }, [state, sending]);

  // El resultado aparece cuando termina de salir el botón: ahí recibe el foco.
  const attachResult = useCallback((element: HTMLParagraphElement | null) => {
    if (element !== null && focusResult.current) {
      focusResult.current = false;
      element.focus();
    }
  }, []);

  function control() {
    if (application !== null) {
      const badge = applicationBadge(application);
      return (
        <p ref={attachResult} className={styles.result} tabIndex={-1}>
          <span className="visually-hidden">Tu postulación: </span>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </p>
      );
    }
    if (state === 'closed') {
      return (
        <Button variant="outline" disabled>
          Convocatoria cerrada
        </Button>
      );
    }
    if (state === 'full') {
      return (
        <Button variant="outline" disabled>
          Cupos agotados
        </Button>
      );
    }
    return (
      <Button
        variant="teal"
        className={styles.apply}
        aria-label={sending ? `Enviando tu postulación a ${title}` : `Postularme a ${title}`}
        aria-disabled={sending}
        aria-busy={sending}
        // Un clic mientras envía no hace nada: quien envía (useApplications) descarta el repetido.
        onClick={onApply}
      >
        {sending ? (
          <>
            <span className={styles.spinner} aria-hidden="true" />
            Enviando…
          </>
        ) : (
          <>
            <span aria-hidden="true">+</span> Postularme
          </>
        )}
      </Button>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={state}
        className={styles.slot}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {control()}
      </motion.span>
    </AnimatePresence>
  );
}
