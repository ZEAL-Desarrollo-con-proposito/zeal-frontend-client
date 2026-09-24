import type { ComponentProps } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { cx } from '@/shared/lib/cx';
import type { ButtonVariant } from './Button';
import { pressFeedback } from './pressFeedback';
import styles from './Button.module.css';

const MotionLink = motion.create(Link);

type LinkButtonProps = ComponentProps<typeof MotionLink> & {
  variant?: ButtonVariant;
  className?: string;
};

/** Enlace de navegación con la apariencia de un botón de marca. */
export function LinkButton({
  variant = 'primary',
  className,
  ...props
}: Readonly<LinkButtonProps>) {
  return (
    <MotionLink
      className={cx(styles.button, styles[variant], className)}
      {...pressFeedback}
      {...props}
    />
  );
}
