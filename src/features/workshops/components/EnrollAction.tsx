import { useId } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useFocusResult } from '@/shared/hooks/useFocusResult';
import type { Spots } from '@/shared/spots/spots';
import { Badge } from '@/shared/ui/Badge/Badge';
import { Button } from '@/shared/ui/Button/Button';
import { availabilityOf } from '../model/workshop';
import styles from './EnrollAction.module.css';

interface EnrollActionProps {
  title: string;
  spots: Spots;
  /** El taller ya empezó: el servidor no recibe más inscripciones. */
  started: boolean;
  /** La persona ya tiene su cupo en este taller. */
  enrolled: boolean;
  /** El servidor está procesando su inscripción. */
  sending: boolean;
  /** `dark`: sobre el fondo teal del taller destacado. */
  surface?: 'light' | 'dark';
  onEnroll: () => void;
}

type EnrollState = 'enrolled' | 'started' | 'full' | 'open';

function enrollState({ enrolled, started, spots }: EnrollActionProps): EnrollState {
  if (enrolled) {
    return 'enrolled';
  }
  if (started) {
    return 'started';
  }
  return availabilityOf(spots).full ? 'full' : 'open';
}

/**
 * Inscribirse según lo que informó el servidor: con cupo, "Inscribirme" abre la confirmación; sin
 * cupos, el botón queda deshabilitado con el motivo a la vista; ya inscrita, "Tienes tu cupo" (y
 * el foco pasa ahí si se acaba de inscribir desde esta pantalla).
 */
export function EnrollAction(props: Readonly<EnrollActionProps>) {
  const { title, sending, surface = 'light', onEnroll } = props;
  const state = enrollState(props);
  const attachResult = useFocusResult(state === 'enrolled', sending);
  const reasonId = useId();

  function control() {
    if (state === 'enrolled') {
      return (
        <p ref={attachResult} className={styles.result} tabIndex={-1}>
          <span className="visually-hidden">Tu inscripción: </span>
          <Badge tone="sage">Tienes tu cupo</Badge>
        </p>
      );
    }
    if (state === 'started') {
      return (
        <Button variant="outline" fullWidth disabled>
          Inscripciones cerradas
        </Button>
      );
    }
    if (state === 'full') {
      return (
        <>
          <Button variant="outline" fullWidth disabled aria-describedby={reasonId}>
            Inscribirme
          </Button>
          <p id={reasonId} className={styles.reason}>
            Este taller ya no tiene cupos.
          </p>
        </>
      );
    }
    return (
      <Button
        fullWidth
        aria-label={`Inscribirme a ${title}`}
        aria-haspopup="dialog"
        onClick={onEnroll}
      >
        Inscribirme
      </Button>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={state}
        className={styles.slot}
        data-surface={surface}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {control()}
      </motion.div>
    </AnimatePresence>
  );
}
