import { motion } from 'motion/react';
import styles from './Switch.module.css';

interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** Interruptor accesible (rol `switch`): el texto forma parte del área que se toca. */
export function Switch({ label, checked, onChange }: Readonly<SwitchProps>) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={styles.switch}
      onClick={() => {
        onChange(!checked);
      }}
    >
      <span className={styles.track} data-checked={checked}>
        <motion.span
          layout
          className={styles.thumb}
          transition={{ type: 'spring', stiffness: 700, damping: 38 }}
        />
      </span>
      <span className={styles.label}>{label}</span>
    </button>
  );
}
