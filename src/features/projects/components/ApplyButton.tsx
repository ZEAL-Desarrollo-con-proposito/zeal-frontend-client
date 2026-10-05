import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/shared/ui/Button/Button';
import { LinkButton } from '@/shared/ui/Button/LinkButton';
import type { Spots } from '../model/project';
import { availableSpots } from '../model/project';

interface ApplyButtonProps {
  title: string;
  spots: Spots;
  /** La convocatoria ya no recibe postulaciones. */
  closed: boolean;
  /** A dónde lleva "Postularme" mientras haya cupos (el detalle de la convocatoria). */
  to?: string;
}

/**
 * Acción de postularse según los cupos que informó el servidor: con cupos lleva a postularse;
 * al llegar a cero (también en vivo) pasa a "Cupos agotados" deshabilitado.
 */
export function ApplyButton({ title, spots, closed, to }: Readonly<ApplyButtonProps>) {
  let state: 'closed' | 'full' | 'open' = 'open';
  if (closed) {
    state = 'closed';
  } else if (availableSpots(spots) === 0) {
    state = 'full';
  }

  function control() {
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
    return to === undefined ? null : (
      <LinkButton to={to} variant="teal" aria-label={`Postularme a ${title}`}>
        <span aria-hidden="true">+</span> Postularme
      </LinkButton>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={state}
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
