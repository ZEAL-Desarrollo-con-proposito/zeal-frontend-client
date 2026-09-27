import { isRecord } from '@/features/auth/model/session';
import { formatDayShort, formatTime, isSameDay } from '@/shared/lib/dates';
import { normalizeForSearch } from '@/shared/lib/text';
import type { AvatarTone } from '@/shared/ui/Avatar/Avatar';
import type { BadgeTone } from '@/shared/ui/Badge/Badge';

export interface TimeRange {
  startsAt: string;
  endsAt: string;
}

/** Psicólogo del directorio (contrato con el Wellbeing Service, HU-BE-04). */
export interface Psychologist {
  id: string;
  fullName: string;
  title: string;
  focusAreas: string[];
  /** Próximo bloque que se puede reservar; lo calcula el servidor. `null` si no hay ninguno. */
  nextFreeSlot: TimeRange | null;
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isTimeRange(value: unknown): value is TimeRange {
  return isRecord(value) && isIsoDateTime(value.startsAt) && isIsoDateTime(value.endsAt);
}

export function isPsychologist(value: unknown): value is Psychologist {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.fullName === 'string' &&
    typeof value.title === 'string' &&
    Array.isArray(value.focusAreas) &&
    value.focusAreas.every((area) => typeof area === 'string') &&
    (value.nextFreeSlot === null || isTimeRange(value.nextFreeSlot))
  );
}

export interface Availability {
  today: boolean;
  badge: { label: string; tone: BadgeTone };
  /** Cuándo es el próximo bloque, en palabras. */
  next: string;
}

/** Lectura para la interfaz del próximo bloque que envió el servidor (Figma B2). */
export function availabilityOf({ nextFreeSlot }: Psychologist, now: number): Availability {
  if (nextFreeSlot === null) {
    return {
      today: false,
      badge: { label: 'Sin bloques', tone: 'neutral' },
      next: 'Aún no abre bloques',
    };
  }
  const start = new Date(nextFreeSlot.startsAt);
  if (isSameDay(start, new Date(now))) {
    return {
      today: true,
      badge: { label: 'Disponible hoy', tone: 'sage' },
      next: `Hoy · ${formatTime(start)}`,
    };
  }
  return {
    today: false,
    badge: { label: 'Agenda llena', tone: 'mauve' },
    next: `${formatDayShort(start)} · ${formatTime(start)}`,
  };
}

const AVATAR_TONES: Record<0 | 1 | 2, AvatarTone> = { 0: 'sage', 1: 'teal', 2: 'mauve' };

/** Color estable por persona: el mismo en su tarjeta y en su perfil, aunque se filtre o reordene. */
export function avatarToneFor(id: string): AvatarTone {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash += id.charCodeAt(index);
  }
  return AVATAR_TONES[(hash % 3) as 0 | 1 | 2];
}

/** Temas del directorio (chips de filtro), sin repetir y en orden alfabético. */
export function topicsOf(psychologists: readonly Psychologist[]): string[] {
  const topics = new Set(psychologists.flatMap(({ focusAreas }) => focusAreas));
  return [...topics].sort((a, b) => a.localeCompare(b, 'es'));
}

export interface DirectoryFilters {
  query: string;
  topic: string | null;
  onlyToday: boolean;
}

export function hasFilters({ query, topic, onlyToday }: DirectoryFilters): boolean {
  return query.trim() !== '' || topic !== null || onlyToday;
}

function matchesQuery({ fullName, title, focusAreas }: Psychologist, query: string): boolean {
  const needle = normalizeForSearch(query);
  return [fullName, title, ...focusAreas].some((text) => normalizeForSearch(text).includes(needle));
}

/** Búsqueda por nombre o especialidad (sin importar tildes), tema y disponibilidad de hoy. */
export function filterDirectory(
  psychologists: readonly Psychologist[],
  filters: DirectoryFilters,
  now: number,
): Psychologist[] {
  return psychologists.filter(
    (psychologist) =>
      matchesQuery(psychologist, filters.query) &&
      (filters.topic === null || psychologist.focusAreas.includes(filters.topic)) &&
      (!filters.onlyToday || availabilityOf(psychologist, now).today),
  );
}
