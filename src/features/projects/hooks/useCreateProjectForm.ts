import { useRef, useState } from 'react';
import { describeMutationError } from '@/shared/api/describeError';
import { createProject } from '../api/adminProjectsApi';
import type { AdminProject } from '../model/adminProject';
import type { ProjectDraft, ProjectDraftField } from '../model/projectDraft';
import {
  DRAFT_FIELDS,
  draftToNewProject,
  EMPTY_DRAFT,
  validateProjectDraft,
} from '../model/projectDraft';

interface CreateProjectFormOptions {
  onPublished: (project: AdminProject) => void;
  /** Se intentó enviar con errores: el primer campo inválido, para llevarle el foco. */
  onInvalid: (field: ProjectDraftField) => void;
}

/**
 * Estado del formulario "Publicar proyecto", separado de su presentación. Un campo muestra su
 * error al salir de él (o al intentar enviar), y desde entonces se revalida mientras se escribe.
 */
export function useCreateProjectForm({ onPublished, onInvalid }: CreateProjectFormOptions) {
  const [draft, setDraft] = useState<ProjectDraft>(EMPTY_DRAFT);
  const [touched, setTouched] = useState<ReadonlySet<ProjectDraftField>>(new Set());
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inFlight = useRef(false);

  const allErrors = validateProjectDraft(draft, new Date());
  const errors: Partial<Record<ProjectDraftField, string>> = {};
  for (const field of DRAFT_FIELDS) {
    if (touched.has(field) && allErrors[field] !== undefined) {
      errors[field] = allErrors[field];
    }
  }

  function update(field: ProjectDraftField, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setSubmitError(null);
  }

  function touch(field: ProjectDraftField) {
    setTouched((previous) => new Set(previous).add(field));
  }

  async function submit() {
    if (inFlight.current) {
      return;
    }
    setTouched(new Set(DRAFT_FIELDS));
    const firstInvalid = DRAFT_FIELDS.find((field) => allErrors[field] !== undefined);
    if (firstInvalid !== undefined) {
      onInvalid(firstInvalid);
      return;
    }
    inFlight.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const project = await createProject(draftToNewProject(draft));
      setDraft(EMPTY_DRAFT);
      setTouched(new Set());
      onPublished(project);
    } catch (error) {
      setSubmitError(describeMutationError(error));
    } finally {
      inFlight.current = false;
      setIsSubmitting(false);
    }
  }

  return { draft, errors, submitError, isSubmitting, update, touch, submit };
}
