import type { Ref } from 'react';
import type { HTMLMotionProps } from 'motion/react';
import { motion } from 'motion/react';
import { cx } from '@/shared/lib/cx';
import { pressFeedback } from './pressFeedback';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'outline' | 'danger';

interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = 'primary',
  fullWidth = false,
  type = 'button',
  disabled = false,
  className,
  ...props
}: Readonly<ButtonProps>) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      className={cx(styles.button, styles[variant], fullWidth && styles.fullWidth, className)}
      {...(disabled ? {} : pressFeedback)}
      {...props}
    />
  );
}
