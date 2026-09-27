import styles from './DirectorySkeleton.module.css';

const PLACEHOLDERS = ['uno', 'dos', 'tres', 'cuatro'] as const;

/** Tarjetas de carga (Figma F4): reservan el espacio del directorio para que nada salte. */
export function DirectorySkeleton() {
  return (
    <ul className={styles.grid} aria-hidden="true">
      {PLACEHOLDERS.map((placeholder) => (
        <li key={placeholder} className={styles.card}>
          <span className={styles.row}>
            <span className={styles.avatar} />
            <span className={styles.lines}>
              <span className={styles.line} />
              <span className={styles.lineShort} />
            </span>
          </span>
          <span className={styles.line} />
          <span className={styles.lineShort} />
          <span className={styles.button} />
        </li>
      ))}
    </ul>
  );
}
