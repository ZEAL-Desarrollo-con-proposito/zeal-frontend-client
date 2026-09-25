import type { ComponentPropsWithRef } from 'react';
import { useId } from 'react';
import { cx } from '@/shared/lib/cx';
import styles from './SelectField.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends Omit<ComponentPropsWithRef<'select'>, 'id' | 'className'> {
  label: string;
  options: readonly SelectOption[];
  error?: string;
}

export function SelectField({ label, options, error, ...selectProps }: Readonly<SelectFieldProps>) {
  const selectId = useId();
  const errorId = `${selectId}-error`;
  const hasError = error !== undefined;

  return (
    <div className={styles.field}>
      <label htmlFor={selectId} className={styles.label}>
        {label}
      </label>
      <select
        id={selectId}
        className={cx(styles.select, hasError && styles.invalid)}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        {...selectProps}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hasError && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
