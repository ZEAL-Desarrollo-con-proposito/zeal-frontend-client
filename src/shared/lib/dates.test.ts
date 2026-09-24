import { describe, expect, it } from 'vitest';
import {
  addDays,
  formatLongDate,
  formatTime,
  formatWeekdayShort,
  formatWeekRange,
  isSameDay,
  minutesSinceMidnight,
  parseIsoDate,
  startOfWeek,
  toIsoDate,
} from './dates';

describe('fechas', () => {
  it.each([
    ['un miércoles', new Date(2026, 8, 23, 15, 30)],
    ['un lunes', new Date(2026, 8, 21, 0, 0)],
    ['un domingo', new Date(2026, 8, 27, 23, 59)],
  ])('startOfWeek lleva %s al lunes a medianoche', (_case, date) => {
    expect(startOfWeek(date)).toEqual(new Date(2026, 8, 21));
  });

  it('suma días cruzando meses sin mutar la fecha original', () => {
    const date = new Date(2026, 8, 29);

    expect(addDays(date, 3)).toEqual(new Date(2026, 9, 2));
    expect(date).toEqual(new Date(2026, 8, 29));
  });

  it('compara días ignorando la hora', () => {
    expect(isSameDay(new Date(2026, 8, 23, 1), new Date(2026, 8, 23, 23))).toBe(true);
    expect(isSameDay(new Date(2026, 8, 23), new Date(2026, 8, 24))).toBe(false);
  });

  it('convierte entre Date y AAAA-MM-DD en hora local', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(parseIsoDate('2026-09-21')).toEqual(new Date(2026, 8, 21));
  });

  it.each(['', '21-09-2026', '2026-9-21', '2026-02-30', '2026-13-01'])(
    'rechaza "%s" como fecha',
    (value) => {
      expect(parseIsoDate(value)).toBeNull();
    },
  );

  it('formatea horas, días y rangos de semana para la interfaz', () => {
    expect(formatTime(new Date(2026, 8, 23, 9, 5))).toBe('9:05');
    expect(formatTime(new Date(2026, 8, 23, 14, 30))).toBe('14:30');
    expect(formatWeekdayShort(new Date(2026, 8, 23))).toBe('MIÉ 23');
    expect(formatLongDate(new Date(2026, 8, 23))).toBe('Miércoles, 23 de septiembre');
    expect(formatWeekRange(new Date(2026, 8, 21), new Date(2026, 8, 25))).toBe(
      'Semana del 21 al 25 de septiembre',
    );
    expect(formatWeekRange(new Date(2026, 8, 28), new Date(2026, 9, 2))).toBe(
      'Semana del 28 de septiembre al 2 de octubre',
    );
    expect(minutesSinceMidnight(new Date(2026, 8, 23, 9, 5))).toBe(545);
  });
});
