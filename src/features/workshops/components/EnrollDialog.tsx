import { useState } from 'react';
import { describeMutationError } from '@/shared/api/describeError';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { useWorkshopSpots } from '../hooks/useWorkshopSpots';
import type { Workshop } from '../model/workshop';
import { availabilityOf, workshopDuration, workshopWhen } from '../model/workshop';

interface EnrollDialogProps {
  workshop: Workshop;
  now: number;
  /** El servidor está procesando la inscripción. */
  pending: boolean;
  /** Pide el cupo al servidor; falla con su motivo si no lo asigna. */
  onEnroll: (workshopId: string) => Promise<unknown>;
  onClose: () => void;
}

/**
 * Confirmación antes de tomar un cupo (HU-FE-18). Sigue los cupos en vivo: si el taller se llena
 * mientras está abierta, lo dice y ya no deja confirmar. Si el servidor rechaza la inscripción, su
 * motivo aparece aquí mismo y se puede reintentar o cancelar.
 */
export function EnrollDialog({
  workshop,
  now,
  pending,
  onEnroll,
  onClose,
}: Readonly<EnrollDialogProps>) {
  const spots = useWorkshopSpots(workshop.id, workshop);
  const full = availabilityOf(spots).full;
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setError(null);
    try {
      await onEnroll(workshop.id);
      onClose();
    } catch (cause) {
      setError(describeMutationError(cause));
    }
  }

  return (
    <ConfirmDialog
      title={`¿Inscribirte en ${workshop.title}?`}
      description={`${workshopWhen(workshop.startsAt, now)} · ${workshopDuration(workshop)} con ${workshop.facilitator}. El cupo es tuyo en cuanto lo confirmemos.`}
      confirmLabel="Sí, inscribirme"
      pendingLabel="Inscribiendo…"
      isPending={pending}
      error={error ?? (full ? 'Este taller se acaba de llenar.' : null)}
      confirmVariant="primary"
      confirmDisabled={full}
      onConfirm={() => void confirm()}
      onCancel={onClose}
    />
  );
}
