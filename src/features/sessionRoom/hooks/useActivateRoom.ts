import { useState } from 'react';
import { describeMutationError } from '@/shared/api/describeError';
import { activateRoom } from '../api/roomApi';

/**
 * El psicólogo activa la sala. Mientras se envía, el botón queda bloqueado; si el servidor la
 * rechaza (p. ej. aún no abre), se muestra su mensaje tal cual.
 */
export function useActivateRoom(reservationId: string) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function activate(): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      await activateRoom(reservationId);
      return true;
    } catch (reason) {
      setError(describeMutationError(reason));
      return false;
    } finally {
      setPending(false);
    }
  }

  return { pending, error, activate };
}
