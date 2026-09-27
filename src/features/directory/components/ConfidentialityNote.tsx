import { useId } from 'react';
import { getFirstName } from '@/shared/lib/text';
import { LockIcon } from '@/shared/ui/icons';
import styles from './ConfidentialityNote.module.css';

interface ConfidentialityNoteProps {
  psychologistName: string;
  organization: string;
}

/** Figma B13 · "Nadie más lo sabe": la garantía de privacidad justo donde se decide reservar. */
export function ConfidentialityNote({
  psychologistName,
  organization,
}: Readonly<ConfidentialityNoteProps>) {
  const titleId = useId();

  return (
    <section className={styles.note} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        <LockIcon />
        Nadie más lo sabe
      </h2>
      <p>
        Ni {organization} ni tu líder sabrán que reservaste con {getFirstName(psychologistName)}: no
        queda ningún registro visible para ellos, no reciben notificaciones y el bloque no aparece
        en tu calendario.
      </p>
    </section>
  );
}
