import type { SelectOption } from '@/shared/ui/SelectField/SelectField';
import type { NewSlot } from '../api/availabilityApi';
import { CALENDAR_END_HOUR, CALENDAR_START_HOUR } from './calendar';

/** Borrador del formulario: día "AAAA-MM-DD" y horas "HH:MM" locales. */
export interface SlotDraft {
  day: string;
  start: string;
  end: string;
}

export type DraftErrors = Partial<Record<keyof SlotDraft, string>>;

const STEP_MINUTES = 15;

export function hourToTime(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/** "HH:MM" → minutos desde la medianoche. */
export function toMinutes(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

function timeOption(totalMinutes: number): SelectOption {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return { value: `${String(hours).padStart(2, '0')}:${minutes}`, label: `${hours}:${minutes}` };
}

function timeRange(fromMinutes: number, toMinutes: number): SelectOption[] {
  const options: SelectOption[] = [];
  for (let minutes = fromMinutes; minutes <= toMinutes; minutes += STEP_MINUTES) {
    options.push(timeOption(minutes));
  }
  return options;
}

/** Inicio posible cada 15 minutos dentro de la jornada del calendario. */
export const START_TIME_OPTIONS = timeRange(
  CALENDAR_START_HOUR * 60,
  CALENDAR_END_HOUR * 60 - STEP_MINUTES,
);
export const END_TIME_OPTIONS = timeRange(
  CALENDAR_START_HOUR * 60 + STEP_MINUTES,
  CALENDAR_END_HOUR * 60,
);

/**
 * Validación de forma del formulario (coherencia de las horas elegidas). Las reglas de negocio
 * —solapes, horarios pasados, duración de sesión— las decide el servidor.
 */
export function validateDraft({ start, end }: SlotDraft): DraftErrors {
  return toMinutes(end) > toMinutes(start)
    ? {}
    : { end: 'La hora de fin debe ser posterior a la de inicio' };
}

/** Convierte el borrador (hora local) al contrato del API (ISO 8601 con zona horaria). */
export function draftToNewSlot({ day, start, end }: SlotDraft): NewSlot {
  return {
    startsAt: new Date(`${day}T${start}:00`).toISOString(),
    endsAt: new Date(`${day}T${end}:00`).toISOString(),
  };
}
