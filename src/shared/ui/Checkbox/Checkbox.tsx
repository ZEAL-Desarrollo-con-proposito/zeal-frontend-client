import type { ComponentPropsWithRef } from 'react';
import { useId } from 'react';
import styles from './Checkbox.module.css';

interface CheckboxProps extends Omit<ComponentPropsWithRef<'input'>, 'id' | 'type' | 'className'> {
  label: string;
}

export function Checkbox({ label, ...inputProps }: Readonly<CheckboxProps>) {
  const inputId = useId();

  return (
    <div className={styles.checkbox}>
      <input id={inputId} type="checkbox" className={styles.input} {...inputProps} />
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
    </div>
  );
}
