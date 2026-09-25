import type { Ref, SubmitEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { formatLongDate, toIsoDate } from '@/shared/lib/dates';
import { Button } from '@/shared/ui/Button/Button';
import { SelectField } from '@/shared/ui/SelectField/SelectField';
import type { useCreateSlotForm } from '../hooks/useCreateSlotForm';
import { END_TIME_OPTIONS, START_TIME_OPTIONS } from '../model/slotDraft';
import styles from './CreateSlotForm.module.css';

interface CreateSlotFormProps {
  form: ReturnType<typeof useCreateSlotForm>;
  days: Date[];
  daySelectRef: Ref<HTMLSelectElement>;
}

/** Formulario "Abrir franja": los pacientes ven la franja apenas el servidor la confirma. */
export function CreateSlotForm({ form, days, daySelectRef }: Readonly<CreateSlotFormProps>) {
  const dayOptions = days.map((day) => ({ value: toIsoDate(day), label: formatLongDate(day) }));

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void form.submit();
  }

  return (
    <section className={styles.card} aria-labelledby="abrir-franja">
      <h2 id="abrir-franja" className={styles.title}>
        Abrir franja
      </h2>
      <p className={styles.hint}>
        Elige el día y el horario, o toca una hora libre del calendario.
      </p>
      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        <SelectField
          ref={daySelectRef}
          label="Día"
          options={dayOptions}
          value={form.draft.day}
          onChange={(event) => {
            form.update('day', event.target.value);
          }}
        />
        <div className={styles.times}>
          <SelectField
            label="Desde"
            options={START_TIME_OPTIONS}
            value={form.draft.start}
            onChange={(event) => {
              form.update('start', event.target.value);
            }}
          />
          <SelectField
            label="Hasta"
            options={END_TIME_OPTIONS}
            value={form.draft.end}
            error={form.errors.end}
            onChange={(event) => {
              form.update('end', event.target.value);
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
          {form.isSubmitting ? 'Abriendo…' : 'Abrir franja'}
        </Button>
      </form>
    </section>
  );
}
