import { useState } from 'react';
import { describeMutationError } from '@/shared/api/describeError';
import { isSameDay, toIsoDate, workdaysOf } from '@/shared/lib/dates';
import { createSlot } from '../api/availabilityApi';
import type { Slot } from '../model/slot';
import type { SlotDraft } from '../model/slotDraft';
import { draftToNewSlot, hourToTime, validateDraft } from '../model/slotDraft';

const DEFAULT_START_HOUR = 8;

function defaultDay(weekStart: Date): string {
  const today = new Date();
  const todayInWeek = workdaysOf(weekStart).some((day) => isSameDay(day, today));
  return toIsoDate(todayInWeek ? today : weekStart);
}

/**
 * Estado del formulario "Abrir franja", separado de su presentación. El día siempre pertenece a
 * la semana visible: si cambia la semana, vuelve a su lunes.
 */
export function useCreateSlotForm(weekStart: Date, onCreated: (slot: Slot) => void) {
  const [draft, setDraft] = useState<SlotDraft>(() => ({
    day: defaultDay(weekStart),
    start: hourToTime(DEFAULT_START_HOUR),
    end: hourToTime(DEFAULT_START_HOUR + 1),
  }));
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const weekDays = workdaysOf(weekStart).map(toIsoDate);
  const current: SlotDraft = {
    ...draft,
    day: weekDays.includes(draft.day) ? draft.day : toIsoDate(weekStart),
  };
  const errors = validateDraft(current);

  function update(field: keyof SlotDraft, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setSubmitError(null);
  }

  /** Atajo desde el calendario: una hora libre propone una franja de una hora. */
  function prefill(day: Date, hour: number) {
    setDraft({ day: toIsoDate(day), start: hourToTime(hour), end: hourToTime(hour + 1) });
    setSubmitError(null);
  }

  async function submit() {
    if (errors.end !== undefined) {
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      onCreated(await createSlot(draftToNewSlot(current)));
    } catch (error) {
      setSubmitError(describeMutationError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return { draft: current, errors, submitError, isSubmitting, update, prefill, submit };
}
