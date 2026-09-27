import { motion } from 'motion/react';
import styles from './TopicFilter.module.css';

interface TopicFilterProps {
  topics: readonly string[];
  selected: string | null;
  onChange: (topic: string | null) => void;
}

/** Chips de tema (Figma B2): uno a la vez; el resaltado se desliza hacia el elegido. */
export function TopicFilter({ topics, selected, onChange }: Readonly<TopicFilterProps>) {
  const options: readonly (string | null)[] = [null, ...topics];

  return (
    <div className={styles.chips} role="group" aria-label="Filtrar por tema">
      {options.map((topic) => {
        const active = topic === selected;
        return (
          <button
            key={topic ?? 'todos'}
            type="button"
            className={styles.chip}
            aria-pressed={active}
            onClick={() => {
              onChange(topic);
            }}
          >
            {active && (
              <motion.span
                layoutId="topic-indicator"
                className={styles.indicator}
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <span className={styles.label}>{topic ?? 'Todos'}</span>
          </button>
        );
      })}
    </div>
  );
}
