import { useEffect, useState } from 'react';
import styles from './BookingPanel.module.css';

interface PanelAlertProps {
  message: string;
  /**
   * Recibe el foco cuando no hay un diálogo abierto: el botón que abrió la confirmación ya no
   * existe y el foco no debe perderse. Con el diálogo abierto, el foco sigue en el diálogo.
   */
  takeFocus: boolean;
}

/** Aviso del panel de reserva (coral de atención) cuando el bloque elegido ya no se puede tomar. */
export function PanelAlert({ message, takeFocus }: Readonly<PanelAlertProps>) {
  const [node, setNode] = useState<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (takeFocus) {
      node?.focus();
    }
  }, [node, takeFocus, message]);

  return (
    <p ref={setNode} className={styles.alert} role="alert" tabIndex={-1}>
      {message}
    </p>
  );
}
