import type { SubmitEvent } from 'react';
import { useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toIsoDate } from '@/shared/lib/dates';
import { Button } from '@/shared/ui/Button/Button';
import { TextAreaField } from '@/shared/ui/TextAreaField/TextAreaField';
import { TextField } from '@/shared/ui/TextField/TextField';
import { useCreateWorkshopForm } from '../hooks/useCreateWorkshopForm';
import type { Workshop } from '../model/workshop';
import type { WorkshopDraftField } from '../model/workshopDraft';
import {
  DESCRIPTION_MAX_LENGTH,
  MAX_CAPACITY,
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
} from '../model/workshopDraft';
import styles from './CreateWorkshopForm.module.css';

interface CreateWorkshopFormProps {
  onPublished: (workshop: Workshop) => void;
}

/** Formulario "Publicar taller" (HU-FE-15): valida campos obligatorios y capacidad. */
export function CreateWorkshopForm({ onPublished }: Readonly<CreateWorkshopFormProps>) {
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const durationRef = useRef<HTMLInputElement>(null);
  const capacityRef = useRef<HTMLInputElement>(null);

  const form = useCreateWorkshopForm({
    onPublished,
    onInvalid: (field) => {
      const target = {
        title: titleRef,
        description: descriptionRef,
        date: dateRef,
        time: timeRef,
        durationMinutes: durationRef,
        capacity: capacityRef,
      } satisfies Record<WorkshopDraftField, { current: HTMLElement | null }>;
      target[field].current?.focus();
    },
  });

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void form.submit();
  }

  const { draft, errors } = form;

  /** Props comunes de cada campo: valor, error y validación al salir. */
  function bind(field: WorkshopDraftField) {
    return {
      value: draft[field],
      error: errors[field],
      onBlur: () => {
        form.touch(field);
      },
    };
  }

  return (
    <section className={styles.card} aria-labelledby="publicar-taller">
      <h2 id="publicar-taller" className={styles.title}>
        Publicar taller
      </h2>
      <p className={styles.hint}>
        Todos los campos son obligatorios. Tus empleados conectados recibirán el aviso al instante.
      </p>
      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        <TextField
          ref={titleRef}
          label="Título del taller"
          autoComplete="off"
          required
          {...bind('title')}
          onChange={(event) => {
            form.update('title', event.target.value);
          }}
        />
        <TextAreaField
          ref={descriptionRef}
          label="Descripción del taller"
          required
          rows={4}
          hint={`Máx. ${String(DESCRIPTION_MAX_LENGTH)} caracteres`}
          {...bind('description')}
          onChange={(event) => {
            form.update('description', event.target.value);
          }}
        />
        <div className={styles.pair}>
          <TextField
            ref={dateRef}
            label="Día del taller"
            type="date"
            min={toIsoDate(new Date())}
            required
            {...bind('date')}
            onChange={(event) => {
              form.update('date', event.target.value);
            }}
          />
          <TextField
            ref={timeRef}
            label="Hora de inicio"
            type="time"
            required
            {...bind('time')}
            onChange={(event) => {
              form.update('time', event.target.value);
            }}
          />
        </div>
        <div className={styles.pair}>
          <TextField
            ref={durationRef}
            label="Duración (minutos)"
            inputMode="numeric"
            autoComplete="off"
            placeholder={`${String(MIN_DURATION_MINUTES)} a ${String(MAX_DURATION_MINUTES)}`}
            required
            {...bind('durationMinutes')}
            onChange={(event) => {
              form.update('durationMinutes', event.target.value);
            }}
          />
          <TextField
            ref={capacityRef}
            label="Capacidad máxima"
            inputMode="numeric"
            autoComplete="off"
            placeholder={`De 1 a ${String(MAX_CAPACITY)}`}
            required
            {...bind('capacity')}
            onChange={(event) => {
              form.update('capacity', event.target.value);
            }}
          />
        </div>

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
          {form.isSubmitting ? 'Publicando…' : 'Publicar taller'}
        </Button>
      </form>
    </section>
  );
}
