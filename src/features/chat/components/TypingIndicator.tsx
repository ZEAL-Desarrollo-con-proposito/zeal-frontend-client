import styles from './TypingIndicator.module.css';

interface TypingIndicatorProps {
  peerName: string;
}

/**"Fulana está escribiendo…" (HU-FE-10): aparece y desaparece sola según `useTypingIndicator`*/
export function TypingIndicator({ peerName }: Readonly<TypingIndicatorProps>) {
  return (
    <p className={styles.typing} role="status">
      {peerName} está escribiendo
      <span className={styles.dots} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </p>
  );
}
