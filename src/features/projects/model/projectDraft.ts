import { parseIsoDate, startOfDay } from '@/shared/lib/dates';
import type { NewProject } from '../api/adminProjectsApi';

/** Borrador del formulario: todo viaja como texto, tal como lo escribe la persona. */
export interface ProjectDraft {
  title: string;
  area: string;
  cohort: string;
  summary: string;
  /** Párrafos separados por una línea en blanco. */
  description: string;
  /** Opcional: un requisito por línea. */
  requirements: string;
  /** Opcional: una habilidad por línea. */
  skills: string;
  capacity: string;
  /** Último día para postularse, "AAAA-MM-DD". */
  closesAt: string;
}

export type ProjectDraftField = keyof ProjectDraft;
export type ProjectDraftErrors = Partial<Record<ProjectDraftField, string>>;

/** Orden visual de los campos: el primero con error recibe el foco al enviar. */
export const DRAFT_FIELDS: readonly ProjectDraftField[] = [
  'title',
  'area',
  'cohort',
  'summary',
  'description',
  'requirements',
  'skills',
  'capacity',
  'closesAt',
];

export const EMPTY_DRAFT: ProjectDraft = {
  title: '',
  area: '',
  cohort: '',
  summary: '',
  description: '',
  requirements: '',
  skills: '',
  capacity: '',
  closesAt: '',
};

export const TITLE_MIN_LENGTH = 5;
export const TITLE_MAX_LENGTH = 80;
export const LABEL_MIN_LENGTH = 2;
export const LABEL_MAX_LENGTH = 40;
export const SUMMARY_MIN_LENGTH = 10;
export const SUMMARY_MAX_LENGTH = 140;
export const DESCRIPTION_MIN_LENGTH = 20;
export const DESCRIPTION_MAX_LENGTH = 1500;
export const MAX_LIST_ITEMS = 8;
export const MAX_LIST_ITEM_LENGTH = 100;
export const MIN_CAPACITY = 1;
export const MAX_CAPACITY = 100;

const INTEGER_PATTERN = /^-?\d+$/;

/** Entero escrito por la persona; `null` si es otra cosa ("2.5", "1e3", "abc"). */
export function parseCapacity(value: string): number | null {
  const text = value.trim();
  return INTEGER_PATTERN.test(text) ? Number(text) : null;
}

/** Párrafos separados por una línea en blanco, sin espacios sobrantes. */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '');
}

/** Una entrada por línea, sin líneas vacías. */
export function splitLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
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

function validateDescription(value: string): string | undefined {
  const paragraphs = splitParagraphs(value);
  return validateText(paragraphs.join(''), {
    min: DESCRIPTION_MIN_LENGTH,
    max: DESCRIPTION_MAX_LENGTH,
    empty: 'Describe el proyecto para quienes van a postularse',
    label: 'La descripción',
  });
}

/** Lista opcional (requisitos, habilidades): una por línea, con tope de cantidad y de largo. */
function validateList(value: string): string | undefined {
  const items = splitLines(value);
  if (items.length > MAX_LIST_ITEMS) {
    return `Escribe como máximo ${String(MAX_LIST_ITEMS)} elementos, uno por línea`;
  }
  return items.some((item) => item.length > MAX_LIST_ITEM_LENGTH)
    ? `Cada línea puede tener hasta ${String(MAX_LIST_ITEM_LENGTH)} caracteres`
    : undefined;
}

function validateCapacity(value: string): string | undefined {
  if (value.trim() === '') {
    return 'Indica cuántos cupos ofrece el proyecto';
  }
  const capacity = parseCapacity(value);
  if (capacity === null) {
    return 'Los cupos deben ser un número entero';
  }
  if (capacity < MIN_CAPACITY) {
    return `El proyecto necesita al menos ${String(MIN_CAPACITY)} cupo`;
  }
  return capacity > MAX_CAPACITY
    ? `El máximo es ${String(MAX_CAPACITY)} cupos por proyecto`
    : undefined;
}

function validateClosesAt(value: string, today: Date): string | undefined {
  const date = parseIsoDate(value);
  if (date === null) {
    return 'Elige la fecha límite para postularse';
  }
  return date.getTime() < startOfDay(today).getTime()
    ? 'La fecha límite no puede ser anterior a hoy'
    : undefined;
}

/**
 * Validación de forma del formulario: campos obligatorios y capacidad. Las reglas de negocio
 * (títulos repetidos, permisos) las decide el servidor.
 */
export function validateProjectDraft(draft: ProjectDraft, today: Date): ProjectDraftErrors {
  const checks: [ProjectDraftField, string | undefined][] = [
    [
      'title',
      validateText(draft.title, {
        min: TITLE_MIN_LENGTH,
        max: TITLE_MAX_LENGTH,
        empty: 'Escribe el título del proyecto',
        label: 'El título',
      }),
    ],
    [
      'area',
      validateText(draft.area, {
        min: LABEL_MIN_LENGTH,
        max: LABEL_MAX_LENGTH,
        empty: 'Indica el área del proyecto',
        label: 'El área',
      }),
    ],
    [
      'cohort',
      validateText(draft.cohort, {
        min: LABEL_MIN_LENGTH,
        max: LABEL_MAX_LENGTH,
        empty: 'Indica la cohorte o ciclo del proyecto',
        label: 'La cohorte',
      }),
    ],
    [
      'summary',
      validateText(draft.summary, {
        min: SUMMARY_MIN_LENGTH,
        max: SUMMARY_MAX_LENGTH,
        empty: 'Escribe un resumen corto para el catálogo',
        label: 'El resumen',
      }),
    ],
    ['description', validateDescription(draft.description)],
    ['requirements', validateList(draft.requirements)],
    ['skills', validateList(draft.skills)],
    ['capacity', validateCapacity(draft.capacity)],
    ['closesAt', validateClosesAt(draft.closesAt, today)],
  ];
  const errors: ProjectDraftErrors = {};
  for (const [field, message] of checks) {
    if (message !== undefined) {
      errors[field] = message;
    }
  }
  return errors;
}

/** Convierte un borrador ya validado al contrato del API. */
export function draftToNewProject(draft: ProjectDraft): NewProject {
  const [year = 0, month = 1, day = 1] = draft.closesAt.split('-').map(Number);
  return {
    title: draft.title.trim(),
    area: draft.area.trim(),
    cohort: draft.cohort.trim(),
    summary: draft.summary.trim(),
    description: splitParagraphs(draft.description),
    requirements: splitLines(draft.requirements),
    skills: splitLines(draft.skills),
    capacity: Number(draft.capacity.trim()),
    // La convocatoria cierra al final del día elegido, en la hora local de quien publica.
    closesAt: new Date(year, month - 1, day, 23, 59, 59).toISOString(),
  };
}
