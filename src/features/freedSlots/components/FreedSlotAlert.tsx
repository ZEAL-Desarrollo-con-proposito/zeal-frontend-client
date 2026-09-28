import type { ComponentType, Ref } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { EMPLOYEE_PATHS } from '@/app/paths';
import { appointmentWhen } from '@/features/appointments/model/appointment';
import { useNow } from '@/shared/hooks/useNow';
import { Button } from '@/shared/ui/Button/Button';
import { AlertIcon, CheckIcon, ClockIcon, CloseIcon } from '@/shared/ui/icons';
import type { ClaimStatus, OfferEntry } from '../model/freedSlotsState';
import { formatCountdown, formatDeadline, remainingMs } from '../model/freedSlot';
import styles from './FreedSlotAlerts.module.css';

const TICK_MS = 1000;

type Tone = 'offer' | 'won' | 'lost';

const TONES: Record<ClaimStatus, Tone> = {
  available: 'offer',
  claiming: 'offer',
  won: 'won',
  lost: 'lost',
  gone: 'lost',
};

const ICONS: Record<Tone, ComponentType> = {
  offer: ClockIcon,
  won: CheckIcon,
  lost: AlertIcon,
};

interface FreedSlotAlertProps {
  entry: OfferEntry;
  onClaim: () => void;
  onDismiss: () => void;
  ref?: Ref<HTMLLIElement>;
}

/**Alerta de que un cupo fue liberado con conteo regresivo  */
export function FreedSlotAlert({ entry, onClaim, onDismiss, ref }: Readonly<FreedSlotAlertProps>) {
  const { offer, claim } = entry;
  const now = useNow(TICK_MS);
  const remaining = remainingMs(offer, now);
  const tone = TONES[claim.status];
  const Icon = ICONS[tone];
  const { psychologist } = offer;
  const when = `${psychologist.fullName} · ${appointmentWhen(offer, now)}`;

  return (
    <motion.li
      ref={ref}
      layout
      className={styles.alert}
      data-tone={tone}
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, transition: { duration: 0.18, ease: 'easeIn' } }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
    >
      <span className={styles.icon} aria-hidden="true">
        <Icon />
      </span>
      <div className={styles.body}>
        <p className={styles.title}>{titleFor(entry, remaining)}</p>
        <p className={styles.message}>{when}</p>
        {claim.status === 'available' && remaining > 0 && (
          <>
            <p className={styles.hint}>
              {/* El contador cambia cada segundo*/}
              <span aria-hidden="true" className={styles.countdown}>
                {formatCountdown(remaining)}
              </span>
              <span className={styles.deadline}>Tómalo antes de las {formatDeadline(offer)}</span>
            </p>
            {claim.error !== null && (
              <p className={styles.error} role="alert">
                {claim.error}
              </p>
            )}
          </>
        )}
        {(claim.status === 'lost' || claim.status === 'gone') && claim.detail !== undefined && (
          <p className={styles.detail}>{claim.detail}</p>
        )}
        <div className={styles.footer}>
          {(claim.status === 'available' || claim.status === 'claiming') && remaining > 0 && (
            <Button
              onClick={onClaim}
              disabled={claim.status === 'claiming'}
              aria-busy={claim.status === 'claiming'}
            >
              {claim.status === 'claiming' ? 'Tomando el cupo…' : 'Tomar el cupo'}
            </Button>
          )}
          {claim.status === 'won' && (
            <Link to={EMPLOYEE_PATHS.appointments} className={styles.action} onClick={onDismiss}>
              Ver mis citas
            </Link>
          )}
        </div>
      </div>
      {claim.status !== 'claiming' && (
        <button
          type="button"
          className={styles.close}
          aria-label="Cerrar aviso de cupo"
          onClick={onDismiss}
        >
          <CloseIcon />
        </button>
      )}
    </motion.li>
  );
}

function titleFor({ claim }: OfferEntry, remaining: number): string {
  switch (claim.status) {
    case 'won':
      return '¡El cupo es tuyo!';
    case 'lost':
      return 'Otra persona lo tomó primero';
    case 'gone':
      return 'Este cupo ya no está disponible';
    case 'claiming':
      return 'Tomando el cupo…';
    case 'available':
      return remaining > 0 ? 'Se liberó un cupo' : 'Se acabó el tiempo para este cupo';
  }
}
