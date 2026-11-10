import { useState } from 'react';
import { describeMutationError } from '@/shared/api/describeError';
import { activateRoom } from '../api/roomApi';
import type { Room } from '../model/room';

/**
 * El psicólogo activa la sala. Mientras se envía, el botón queda bloqueado; si el servidor la
 * rechaza (p. ej. aún no abre), se muestra su mensaje tal cual. Devuelve la sala ya activa, con
 * el permiso para entrar al video, o `null` si no se pudo.
 */
export function useActivateRoom(reservationId: string) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function activate(): Promise<Room | null> {
    setPending(true);
    setError(null);
    try {
      return await activateRoom(reservationId);
    } catch (reason) {
      setError(describeMutationError(reason));
      return null;
    } finally {
      setPending(false);
    }
  }

  return { pending, error, activate };
}
