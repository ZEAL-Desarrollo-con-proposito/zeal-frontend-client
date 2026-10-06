import type { SubmitEvent } from 'react';
import { useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toIsoDate } from '@/shared/lib/dates';
import { Button } from '@/shared/ui/Button/Button';
import { TextAreaField } from '@/shared/ui/TextAreaField/TextAreaField';
import { TextField } from '@/shared/ui/TextField/TextField';
import { useCreateProjectForm } from '../hooks/useCreateProjectForm';
import type { AdminProject } from '../model/adminProject';
import type { ProjectDraftField } from '../model/projectDraft';
import {
  DESCRIPTION_MAX_LENGTH,
  MAX_CAPACITY,
  MAX_LIST_ITEMS,
  SUMMARY_MAX_LENGTH,
} from '../model/projectDraft';
import styles from './CreateProjectForm.module.css';

interface CreateProjectFormProps {
  onPublished: (project: AdminProject) => void;
}

/** Formulario "Publicar proyecto" (HU-FE-14): valida campos obligatorios y capacidad. */
export function CreateProjectForm({ onPublished }: Readonly<CreateProjectFormProps>) {
  const titleRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLInputElement>(null);
  const cohortRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const requirementsRef = useRef<HTMLTextAreaElement>(null);
  const skillsRef = useRef<HTMLTextAreaElement>(null);
  const capacityRef = useRef<HTMLInputElement>(null);
  const closesAtRef = useRef<HTMLInputElement>(null);

  const form = useCreateProjectForm({
    onPublished,
    onInvalid: (field) => {
      const target = {
        title: titleRef,
        area: areaRef,
        cohort: cohortRef,
        summary: summaryRef,
        description: descriptionRef,
        requirements: requirementsRef,
        skills: skillsRef,
        capacity: capacityRef,
        closesAt: closesAtRef,
      } satisfies Record<ProjectDraftField, { current: HTMLElement | null }>;
      target[field].current?.focus();
    },
  });

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void form.submit();
  }

  const { draft, errors } = form;

  /** Props comunes de cada campo: valor, error y validación al salir. */
  function bind(field: ProjectDraftField) {
    return {
      value: draft[field],
      error: errors[field],
      onBlur: () => {
        form.touch(field);
      },
    };
  }

  return (
    <section className={styles.card} aria-labelledby="publicar-proyecto">
      <h2 id="publicar-proyecto" className={styles.title}>
        Publicar proyecto
      </h2>
      <p className={styles.hint}>Los campos marcados como opcionales pueden quedar vacíos.</p>
      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        <TextField
          ref={titleRef}
          label="Título del proyecto"
          autoComplete="off"
          required
          {...bind('title')}
          onChange={(event) => {
            form.update('title', event.target.value);
          }}
        />
        <TextField
          ref={areaRef}
          label="Área"
          autoComplete="off"
          placeholder="Ej. Datos"
          required
          {...bind('area')}
          onChange={(event) => {
            form.update('area', event.target.value);
          }}
        />
        <TextField
          ref={cohortRef}
          label="Cohorte"
          autoComplete="off"
          placeholder="Ej. Rotación trimestral"
          required
          {...bind('cohort')}
          onChange={(event) => {
            form.update('cohort', event.target.value);
          }}
        />
        <TextField
          ref={summaryRef}
          label="Resumen para el catálogo"
          autoComplete="off"
          maxLength={SUMMARY_MAX_LENGTH}
          required
          {...bind('summary')}
          onChange={(event) => {
            form.update('summary', event.target.value);
          }}
        />
        <TextAreaField
          ref={descriptionRef}
          label="Descripción"
          required
          rows={5}
          hint={`Separa los párrafos con una línea en blanco · máx. ${String(DESCRIPTION_MAX_LENGTH)}`}
          {...bind('description')}
          onChange={(event) => {
            form.update('description', event.target.value);
          }}
        />
        <TextAreaField
          ref={requirementsRef}
          label="Requisitos (opcional)"
          rows={3}
          hint={`Uno por línea · máx. ${String(MAX_LIST_ITEMS)}`}
          {...bind('requirements')}
          onChange={(event) => {
            form.update('requirements', event.target.value);
          }}
        />
        <TextAreaField
          ref={skillsRef}
          label="Habilidades (opcional)"
          rows={3}
          hint={`Una por línea · máx. ${String(MAX_LIST_ITEMS)}`}
          {...bind('skills')}
          onChange={(event) => {
            form.update('skills', event.target.value);
          }}
        />
        <TextField
          ref={capacityRef}
          label="Cupos disponibles"
          inputMode="numeric"
          autoComplete="off"
          placeholder={`De 1 a ${String(MAX_CAPACITY)}`}
          required
          {...bind('capacity')}
          onChange={(event) => {
            form.update('capacity', event.target.value);
          }}
        />
        <TextField
          ref={closesAtRef}
          label="Fecha límite para postularse"
          type="date"
          min={toIsoDate(new Date())}
          required
          {...bind('closesAt')}
          onChange={(event) => {
            form.update('closesAt', event.target.value);
          }}
        />

        <AnimatePresence initial={false}>
          {form.submitError !== null && (
            <motion.p
              className={styles.error}
              role="alert"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {form.submitError}
            </motion.p>
          )}
        </AnimatePresence>

        <Button type="submit" fullWidth disabled={form.isSubmitting} aria-busy={form.isSubmitting}>
          {form.isSubmitting ? 'Publicando…' : 'Publicar proyecto'}
        </Button>
      </form>
    </section>
  );
}
