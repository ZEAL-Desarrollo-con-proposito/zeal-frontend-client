import type { ComponentPropsWithRef } from 'react';
import { useId } from 'react';
import { cx } from '@/shared/lib/cx';
import styles from './TextField.module.css';

interface TextFieldProps extends Omit<ComponentPropsWithRef<'input'>, 'id' | 'className'> {
  label: string;
  error?: string;
}

export function TextField({ label, error, ...inputProps }: Readonly<TextFieldProps>) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const hasError = error !== undefined;

  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <input
        id={inputId}
        className={cx(styles.input, hasError && styles.invalid)}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        {...inputProps}
      />
      {hasError && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
