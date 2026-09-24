import { useState } from 'react';
import { describeMutationError } from '@/shared/api/describeError';
import { ApiError } from '@/shared/api/errors';
import { deleteSlot } from '../api/availabilityApi';
import type { Slot } from '../model/slot';

export type DeleteOutcome = 'deleted' | 'already-gone';

interface DeleteSlotHandlers {
  onDeleted: (slot: Slot, outcome: DeleteOutcome) => void;
  /** El servidor rechazó el cambio: la franja cambió en otro lado (p. ej. la reservaron). */
  onConflict: () => void;
}

/**
 * Flujo "eliminar franja" con confirmación. Es idempotente frente a otras sesiones: si la franja
 * ya no existe (404) se da por eliminada; si alguien la reservó mientras tanto (409) se muestra
 * el motivo del servidor y se pide recargar la semana.
 */
export function useDeleteSlot({ onDeleted, onConflict }: DeleteSlotHandlers) {
  const [target, setTarget] = useState<Slot | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function request(slot: Slot) {
    setTarget(slot);
    setError(null);
  }

  function cancel() {
    setTarget(null);
  }

  async function confirm(slot: Slot) {
    setIsPending(true);
    setError(null);
    try {
      await deleteSlot(slot.id);
      setTarget(null);
      onDeleted(slot, 'deleted');
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 404) {
        setTarget(null);
        onDeleted(slot, 'already-gone');
        return;
      }
      setError(describeMutationError(reason));
      if (reason instanceof ApiError && reason.status === 409) {
        onConflict();
      }
    } finally {
      setIsPending(false);
    }
  }

  return { target, isPending, error, request, cancel, confirm };
}
