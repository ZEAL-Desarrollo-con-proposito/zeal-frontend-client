import { useRef, useState } from 'react';
import { describeMutationError } from '@/shared/api/describeError';
import { createWorkshop } from '../api/adminWorkshopsApi';
import type { Workshop } from '../model/workshop';
import type {
  WorkshopDraft,
  WorkshopDraftErrors,
  WorkshopDraftField,
} from '../model/workshopDraft';
import {
  draftToNewWorkshop,
  EMPTY_WORKSHOP_DRAFT,
  validateWorkshopDraft,
  WORKSHOP_DRAFT_FIELDS,
} from '../model/workshopDraft';

interface CreateWorkshopFormOptions {
  onPublished: (workshop: Workshop) => void;
  /** Se intentó enviar con errores: el primer campo inválido, para llevarle el foco. */
  onInvalid: (field: WorkshopDraftField) => void;
}

/**
 * Estado del formulario "Publicar taller", separado de su presentación. Un campo muestra su
 * error al salir de él (o al intentar enviar), y desde entonces se revalida mientras se escribe.
 */
export function useCreateWorkshopForm({ onPublished, onInvalid }: CreateWorkshopFormOptions) {
  const [draft, setDraft] = useState<WorkshopDraft>(EMPTY_WORKSHOP_DRAFT);
  const [touched, setTouched] = useState<ReadonlySet<WorkshopDraftField>>(new Set());
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inFlight = useRef(false);

  const allErrors = validateWorkshopDraft(draft, new Date());
  const errors: WorkshopDraftErrors = {};
  for (const field of WORKSHOP_DRAFT_FIELDS) {
    if (touched.has(field) && allErrors[field] !== undefined) {
      errors[field] = allErrors[field];
    }
  }

  function update(field: WorkshopDraftField, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setSubmitError(null);
  }

  function touch(field: WorkshopDraftField) {
    setTouched((previous) => new Set(previous).add(field));
  }

  async function submit() {
    if (inFlight.current) {
      return;
    }
    setTouched(new Set(WORKSHOP_DRAFT_FIELDS));
    const firstInvalid = WORKSHOP_DRAFT_FIELDS.find((field) => allErrors[field] !== undefined);
    if (firstInvalid !== undefined) {
      onInvalid(firstInvalid);
      return;
    }
    inFlight.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const workshop = await createWorkshop(draftToNewWorkshop(draft));
      setDraft(EMPTY_WORKSHOP_DRAFT);
      setTouched(new Set());
      onPublished(workshop);
    } catch (error) {
      setSubmitError(describeMutationError(error));
    } finally {
      inFlight.current = false;
      setIsSubmitting(false);
    }
  }

  return { draft, errors, submitError, isSubmitting, update, touch, submit };
}
