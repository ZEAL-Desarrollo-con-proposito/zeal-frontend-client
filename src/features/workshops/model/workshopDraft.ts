import { parseIsoDate, startOfDay } from '@/shared/lib/dates';
import type { NewWorkshop } from '../api/adminWorkshopsApi';

/** Borrador del formulario: todo viaja como texto, tal como lo escribe la persona. */
export interface WorkshopDraft {
  title: string;
  description: string;
  /** Día del taller, "AAAA-MM-DD". */
  date: string;
  /** Hora de inicio en reloj de 24 h, "HH:MM". */
  time: string;
  durationMinutes: string;
  capacity: string;
}

export type WorkshopDraftField = keyof WorkshopDraft;
export type WorkshopDraftErrors = Partial<Record<WorkshopDraftField, string>>;

/** Orden visual de los campos: el primero con error recibe el foco al enviar. */
export const WORKSHOP_DRAFT_FIELDS: readonly WorkshopDraftField[] = [
  'title',
  'description',
  'date',
  'time',
  'durationMinutes',
  'capacity',
];

export const EMPTY_WORKSHOP_DRAFT: WorkshopDraft = {
  title: '',
  description: '',
  date: '',
  time: '',
  durationMinutes: '',
  capacity: '',
};

export const TITLE_MIN_LENGTH = 5;
export const TITLE_MAX_LENGTH = 80;
export const DESCRIPTION_MIN_LENGTH = 20;
export const DESCRIPTION_MAX_LENGTH = 600;
export const MIN_DURATION_MINUTES = 15;
export const MAX_DURATION_MINUTES = 240;
export const MIN_CAPACITY = 1;
export const MAX_CAPACITY = 200;

const INTEGER_PATTERN = /^-?\d+$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

/** Entero escrito por la persona; `null` si es otra cosa ("2.5", "1e3", "abc"). */
export function parseWholeNumber(value: string): number | null {
  const text = value.trim();
  return INTEGER_PATTERN.test(text) ? Number(text) : null;
}

/** "HH:MM" → [horas, minutos]; `null` si no es una hora real del reloj de 24 h. */
export function parseTime(value: string): [number, number] | null {
  const match = TIME_PATTERN.exec(value);
  if (match === null) {
    return null;
  }
  const [hours, minutes] = match.slice(1).map(Number) as [number, number];
  return hours < 24 && minutes < 60 ? [hours, minutes] : null;
}

/** Inicio del taller en hora local; `null` si falta o es inválido el día o la hora. */
export function startOfWorkshop(date: string, time: string): Date | null {
  const day = parseIsoDate(date);
  const clock = parseTime(time);
  if (day === null || clock === null) {
    return null;
  }
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), clock[0], clock[1]);
}

function validateText(
  value: string,
  rule: { min: number; max: number; empty: string; label: string },
): string | undefined {
  const length = value.trim().length;
  if (length === 0) {
    return rule.empty;
  }
  if (length < rule.min) {
    return `${rule.label} debe tener al menos ${String(rule.min)} caracteres`;
  }
  return length > rule.max
    ? `${rule.label} no puede superar los ${String(rule.max)} caracteres`
    : undefined;
}

function validateDate(value: string, today: Date): string | undefined {
  const date = parseIsoDate(value);
  if (date === null) {
    return 'Elige el día del taller';
  }
  return date.getTime() < startOfDay(today).getTime()
    ? 'El taller no puede ser en un día pasado'
    : undefined;
}

function validateTime(draft: WorkshopDraft, now: Date): string | undefined {
  if (parseTime(draft.time) === null) {
    return 'Indica la hora de inicio';
  }
  const start = startOfWorkshop(draft.date, draft.time);
  // Si el día ya es inválido, ese campo lo explica; aquí solo se compara con el reloj.
  return start !== null && start.getTime() <= now.getTime()
    ? 'La hora de inicio debe ser posterior a este momento'
    : undefined;
}

function validateDuration(value: string): string | undefined {
  if (value.trim() === '') {
    return 'Indica cuánto dura el taller, en minutos';
  }
  const minutes = parseWholeNumber(value);
  if (minutes === null) {
    return 'La duración debe ser un número entero de minutos';
  }
  if (minutes < MIN_DURATION_MINUTES) {
    return `El taller debe durar al menos ${String(MIN_DURATION_MINUTES)} minutos`;
  }
  return minutes > MAX_DURATION_MINUTES
    ? `El taller puede durar hasta ${String(MAX_DURATION_MINUTES)} minutos`
    : undefined;
}

function validateCapacity(value: string): string | undefined {
  if (value.trim() === '') {
    return 'Indica cuántas personas caben en el taller';
  }
  const capacity = parseWholeNumber(value);
  if (capacity === null) {
    return 'La capacidad debe ser un número entero';
  }
  if (capacity < MIN_CAPACITY) {
    return `El taller necesita capacidad para al menos ${String(MIN_CAPACITY)} persona`;
  }
  return capacity > MAX_CAPACITY
    ? `El máximo es ${String(MAX_CAPACITY)} personas por taller`
    : undefined;
}

/**
 * Validación de forma del formulario: campos obligatorios y capacidad. Las reglas de negocio
 * (talleres repetidos, permisos) las decide el servidor.
 */
export function validateWorkshopDraft(draft: WorkshopDraft, now: Date): WorkshopDraftErrors {
  const checks: [WorkshopDraftField, string | undefined][] = [
    [
      'title',
      validateText(draft.title, {
        min: TITLE_MIN_LENGTH,
        max: TITLE_MAX_LENGTH,
        empty: 'Escribe el título del taller',
        label: 'El título',
      }),
    ],
    [
      'description',
      validateText(draft.description, {
        min: DESCRIPTION_MIN_LENGTH,
        max: DESCRIPTION_MAX_LENGTH,
        empty: 'Describe de qué trata el taller',
        label: 'La descripción',
      }),
    ],
    ['date', validateDate(draft.date, now)],
    ['time', validateTime(draft, now)],
    ['durationMinutes', validateDuration(draft.durationMinutes)],
    ['capacity', validateCapacity(draft.capacity)],
  ];
  const errors: WorkshopDraftErrors = {};
  for (const [field, message] of checks) {
    if (message !== undefined) {
      errors[field] = message;
    }
  }
  return errors;
}

/** Convierte un borrador ya validado al contrato del API. */
export function draftToNewWorkshop(draft: WorkshopDraft): NewWorkshop {
  const start = startOfWorkshop(draft.date, draft.time) ?? new Date(Number.NaN);
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    // El taller empieza a la hora local de quien lo publica.
    startsAt: start.toISOString(),
    durationMinutes: Number(draft.durationMinutes.trim()),
    capacity: Number(draft.capacity.trim()),
  };
}
