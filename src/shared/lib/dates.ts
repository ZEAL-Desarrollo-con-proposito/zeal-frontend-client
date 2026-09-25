/**
 * Utilidades de fecha en hora local, sin dependencias. Las fechas del API viajan en ISO 8601;
 * aquí solo se calculan rangos de semana y se formatean textos de interfaz.
 */

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const weekdayShortFormatter = new Intl.DateTimeFormat('es-CO', { weekday: 'short' });
const dayMonthFormatter = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long' });
const monthFormatter = new Intl.DateTimeFormat('es-CO', { month: 'long' });
const longDateFormatter = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

function atMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Lunes de la semana de `date`, a las 00:00 locales. */
export function startOfWeek(date: Date): Date {
  const monday = atMidnight(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Semana laboral de lunes a viernes, como las grillas del Figma (C1 y C8). */
export const WORKDAYS_PER_WEEK = 5;

export function workdaysOf(weekStart: Date): Date[] {
  return Array.from({ length: WORKDAYS_PER_WEEK }, (_, index) => addDays(weekStart, index));
}

/** Viernes de la semana laboral que empieza en `weekStart`. */
export function workweekEnd(weekStart: Date): Date {
  return addDays(weekStart, WORKDAYS_PER_WEEK - 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return atMidnight(a).getTime() === atMidnight(b).getTime();
}

/** "2026-09-23" en hora local (formato de los parámetros del API y de la URL). */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Interpreta "AAAA-MM-DD" como fecha local; `null` si no es una fecha real. */
export function parseIsoDate(value: string): Date | null {
  const match = ISO_DATE_PATTERN.exec(value);
  if (match === null) {
    return null;
  }
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  const date = new Date(year, month - 1, day);
  return toIsoDate(date) === value ? date : null;
}

/** "9:05", "14:30": reloj de 24 h, legible en agendas. */
export function formatTime(date: Date): string {
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** "LUN 21": encabezado de columna del calendario (Figma C8). */
export function formatWeekdayShort(date: Date): string {
  const weekday = weekdayShortFormatter.format(date).replace('.', '').toUpperCase();
  return `${weekday} ${date.getDate()}`;
}

/** "Martes, 23 de septiembre". */
export function formatLongDate(date: Date): string {
  const formatted = longDateFormatter.format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/** "Semana del 21 al 25 de septiembre" o "Semana del 29 de septiembre al 3 de octubre". */
export function formatWeekRange(start: Date, end: Date): string {
  if (start.getMonth() === end.getMonth()) {
    return `Semana del ${start.getDate()} al ${end.getDate()} de ${monthFormatter.format(end)}`;
  }
  return `Semana del ${dayMonthFormatter.format(start)} al ${dayMonthFormatter.format(end)}`;
}

export function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}
