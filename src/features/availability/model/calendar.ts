import { addDays, isSameDay, minutesSinceMidnight } from '@/shared/lib/dates';
import type { Slot } from './slot';
import { compareByStart } from './slot';

/** Ventana visible del calendario (Figma C8: jornada por bloques de una hora). */
export const CALENDAR_START_HOUR = 7;
export const CALENDAR_END_HOUR = 19;
export const HOUR_HEIGHT_PX = 56;
/** Lunes a viernes, como la grilla del Figma. */
export const WORKDAYS_PER_WEEK = 5;

export const CALENDAR_HOURS = Array.from(
  { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR },
  (_, index) => CALENDAR_START_HOUR + index,
);

export const CALENDAR_HEIGHT_PX = CALENDAR_HOURS.length * HOUR_HEIGHT_PX;

export function workdaysOf(weekStart: Date): Date[] {
  return Array.from({ length: WORKDAYS_PER_WEEK }, (_, index) => addDays(weekStart, index));
}

export function slotsOfDay(slots: readonly Slot[], day: Date): Slot[] {
  return slots.filter((slot) => isSameDay(new Date(slot.startsAt), day)).sort(compareByStart);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Posición vertical (px) de una franja dentro de la columna del día. Lo que cae fuera de la
 * jornada visible se recorta a sus bordes para que nunca desborde la grilla.
 */
export function slotBox(slot: Pick<Slot, 'startsAt' | 'endsAt'>): { top: number; height: number } {
  const windowStart = CALENDAR_START_HOUR * 60;
  const windowEnd = CALENDAR_END_HOUR * 60;
  const start = clamp(minutesSinceMidnight(new Date(slot.startsAt)), windowStart, windowEnd);
  const end = clamp(minutesSinceMidnight(new Date(slot.endsAt)), windowStart, windowEnd);
  const pxPerMinute = HOUR_HEIGHT_PX / 60;
  return { top: (start - windowStart) * pxPerMinute, height: (end - start) * pxPerMinute };
}
