import { isRecord } from '@/features/auth/model/session';
import type { AvatarTone } from '@/shared/ui/Avatar/Avatar';
import { addDays, isSameDay, startOfDay } from '@/shared/lib/dates';

/** Cupos de una convocatoria. Los decide el servidor; `version` crece con cada cambio. */
export interface Spots {
  capacity: number;
  occupied: number;
  version: number;
}

/** Convocatoria interna con cupos limitados, como la ve un empleado (contrato con HU-BE-16). */
export interface Project extends Spots {
  id: string;
  title: string;
  /** Área que convoca y cohorte, p. ej. "Plataforma" y "Semilla 2026-2". */
  area: string;
  cohort: string;
  summary: string;
  /** Hasta cuándo se reciben postulaciones. */
  closesAt: string;
}

/** Vista de detalle (Figma B11). */
export interface ProjectDetail extends Project {
  description: string[];
  requirements: string[];
  /** Lo que la convocatoria suma al ZEAL Path de la persona. */
  skills: string[];
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isTextList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isSpots(value: unknown): value is Spots {
  return (
    isRecord(value) && isCount(value.capacity) && isCount(value.occupied) && isCount(value.version)
  );
}

export function isProject(value: unknown): value is Project {
  return (
    isSpots(value) &&
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.area === 'string' &&
    typeof value.cohort === 'string' &&
    typeof value.summary === 'string' &&
    typeof value.closesAt === 'string' &&
    !Number.isNaN(Date.parse(value.closesAt))
  );
}

export function isProjectDetail(value: unknown): value is ProjectDetail {
  return (
    isProject(value) &&
    isRecord(value) &&
    isTextList(value.description) &&
    isTextList(value.requirements) &&
    isTextList(value.skills)
  );
}

/** Cupos que quedan; nunca negativo aunque el servidor reporte más ocupados que capacidad. */
export function availableSpots({ capacity, occupied }: Spots): number {
  return Math.max(capacity - occupied, 0);
}

/** "Quedan 3 de 8 cupos", "Queda 1 de 6 cupos" o "Sin cupos · 3 de 3 ocupados". */
export function spotsLabel(spots: Spots): string {
  const available = availableSpots(spots);
  const capacity = String(spots.capacity);
  if (available === 0) {
    return `Sin cupos · ${capacity} de ${capacity} ocupados`;
  }
  return available === 1
    ? `Queda 1 de ${capacity} cupos`
    : `Quedan ${String(available)} de ${capacity} cupos`;
}

export interface Closing {
  label: string;
  /** Faltan tres días o menos: se resalta en coral (Figma B8). */
  urgent: boolean;
  closed: boolean;
}

const URGENT_DAYS = 3;

/** "Cierra en 9 días", "Cierra mañana", "Cierra hoy" o "Cerrada", según el reloj. */
export function closingOf(closesAt: string, now: number): Closing {
  const closing = new Date(closesAt);
  if (closing.getTime() <= now) {
    return { label: 'Cerrada', urgent: true, closed: true };
  }
  const today = new Date(now);
  if (isSameDay(closing, today)) {
    return { label: 'Cierra hoy', urgent: true, closed: false };
  }
  if (isSameDay(closing, addDays(today, 1))) {
    return { label: 'Cierra mañana', urgent: true, closed: false };
  }
  const days = Math.round(
    (startOfDay(closing).getTime() - startOfDay(today).getTime()) / (24 * 60 * 60 * 1000),
  );
  return { label: `Cierra en ${String(days)} días`, urgent: days <= URGENT_DAYS, closed: false };
}

const CONNECTORS = new Set(['de', 'del', 'la', 'el', 'en', 'y', 'a', 'para', 'con', '·']);

/** Iniciales del hexágono de la convocatoria ("Squad de Observabilidad" → "SO"). */
export function projectInitials(title: string): string {
  return title
    .split(/\s+/)
    .filter((word) => word !== '' && !CONNECTORS.has(word.toLowerCase()))
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();
}

const TONES: readonly [AvatarTone, AvatarTone, AvatarTone] = ['sage', 'mauve', 'teal'];

/** Color estable del hexágono de cada convocatoria. */
export function projectTone(id: string): AvatarTone {
  let hash = 0;
  for (const character of id) {
    hash += character.charCodeAt(0);
  }
  return TONES[(hash % TONES.length) as 0 | 1 | 2];
}
