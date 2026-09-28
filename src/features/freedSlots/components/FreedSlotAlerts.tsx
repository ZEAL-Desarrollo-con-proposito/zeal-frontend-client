import { AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import { useFreedSlots } from '../hooks/useFreedSlots';
import { FreedSlotAlert } from './FreedSlotAlert';
import styles from './FreedSlotAlerts.module.css';

/**
 * Alertas de cupos liberados del día (HU-FE-08). Viven en la estructura de las pantallas del
 * empleado para que lleguen sin importar dónde esté. La región siempre está en el documento para
 * que los lectores de pantalla anuncien cada alerta nueva, sin robar el foco.
 */
export function FreedSlotAlerts() {
  const { offers, claim, dismiss } = useFreedSlots();

  return createPortal(
    <section className={styles.viewport} aria-label="Cupos liberados" aria-live="polite">
      <ol className={styles.list}>
        <AnimatePresence initial={false}>
          {offers.map((entry) => (
            <FreedSlotAlert
              key={entry.offer.id}
              entry={entry}
              onClaim={() => {
                void claim(entry.offer.id);
              }}
              onDismiss={() => {
                dismiss(entry.offer.id);
              }}
            />
          ))}
        </AnimatePresence>
      </ol>
    </section>,
    document.body,
  );
}
