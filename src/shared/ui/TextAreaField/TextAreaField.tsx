import type { ComponentPropsWithRef } from 'react';
import { useId } from 'react';
import { cx } from '@/shared/lib/cx';
import styles from './TextAreaField.module.css';

interface TextAreaFieldProps extends Omit<ComponentPropsWithRef<'textarea'>, 'id' | 'className'> {
  label: string;
  error?: string;
  /** Ayuda bajo el campo (p. ej. un contador de caracteres). */
  hint?: string;
}

/** Área de texto con la misma etiqueta, error y accesibilidad que `TextField`. */
export function TextAreaField({
  label,
  error,
  hint,
  ...textareaProps
}: Readonly<TextAreaFieldProps>) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const hasError = error !== undefined;
  const describedBy = [hint === undefined ? null : hintId, hasError ? errorId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.field}>
      <label htmlFor={fieldId} className={styles.label}>
        {label}
      </label>
      <textarea
        id={fieldId}
        className={cx(styles.textarea, hasError && styles.invalid)}
        aria-invalid={hasError}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        {...textareaProps}
      />
      {hint !== undefined && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {hasError && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
