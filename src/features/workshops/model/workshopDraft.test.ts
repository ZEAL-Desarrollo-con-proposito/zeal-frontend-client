import { describe, expect, it } from 'vitest';
import type { WorkshopDraft } from './workshopDraft';
import {
  draftToNewWorkshop,
  EMPTY_WORKSHOP_DRAFT,
  MAX_CAPACITY,
  MAX_DURATION_MINUTES,
  parseTime,
  parseWholeNumber,
  startOfWorkshop,
  validateWorkshopDraft,
} from './workshopDraft';

const NOW = new Date(2026, 8, 23, 9, 20);

const VALID: WorkshopDraft = {
  title: 'Taller de respiración',
  description: 'Una sesión práctica para respirar mejor durante la jornada.',
  date: '2026-10-10',
  time: '15:00',
  durationMinutes: '60',
  capacity: '25',
};

function errorsOf(draft: WorkshopDraft) {
  return validateWorkshopDraft(draft, NOW);
}

describe('validateWorkshopDraft', () => {
  it('acepta un borrador completo con fecha futura', () => {
    expect(errorsOf(VALID)).toEqual({});
    expect(errorsOf({ ...VALID, date: '2026-09-23', time: '15:00' })).toEqual({});
  });

  it.each<[string, string]>([
    ['', 'Escribe el título del taller'],
    ['   ', 'Escribe el título del taller'],
    ['abc', 'El título debe tener al menos 5 caracteres'],
    ['x'.repeat(81), 'El título no puede superar los 80 caracteres'],
  ])('explica el título %j', (title, message) => {
    expect(errorsOf({ ...VALID, title }).title).toBe(message);
  });

  it.each<[string, string]>([
    ['', 'Describe de qué trata el taller'],
    ['Muy corta', 'La descripción debe tener al menos 20 caracteres'],
    ['x'.repeat(601), 'La descripción no puede superar los 600 caracteres'],
  ])('explica la descripción %j', (description, message) => {
    expect(errorsOf({ ...VALID, description }).description).toBe(message);
  });

  it.each<[string, string]>([
    ['', 'Elige el día del taller'],
    ['2026-02-30', 'Elige el día del taller'],
    ['2026-09-01', 'El taller no puede ser en un día pasado'],
  ])('explica el día %j', (date, message) => {
    expect(errorsOf({ ...VALID, date }).date).toBe(message);
  });

  it.each<[string, string]>([
    ['', 'Indica la hora de inicio'],
    ['9:5', 'Indica la hora de inicio'],
    ['25:00', 'Indica la hora de inicio'],
    ['15:70', 'Indica la hora de inicio'],
  ])('explica la hora %j', (time, message) => {
    expect(errorsOf({ ...VALID, time }).time).toBe(message);
  });

  it('explica cuando la hora ya pasó, y calla si el día es el que explica', () => {
    expect(errorsOf({ ...VALID, date: '2026-09-23', time: '08:00' }).time).toBe(
      'La hora de inicio debe ser posterior a este momento',
    );
    expect(errorsOf({ ...VALID, date: '2026-09-23', time: '09:20' }).time).toBe(
      'La hora de inicio debe ser posterior a este momento',
    );
    // Con el día inválido, el error del día basta; aquí no se compara con el reloj.
    expect(errorsOf({ ...VALID, date: '', time: '15:00' }).time).toBeUndefined();
  });

  it.each<[string, string]>([
    ['', 'Indica cuánto dura el taller, en minutos'],
    ['2.5', 'La duración debe ser un número entero de minutos'],
    ['abc', 'La duración debe ser un número entero de minutos'],
    ['10', 'El taller debe durar al menos 15 minutos'],
    ['241', `El taller puede durar hasta ${String(MAX_DURATION_MINUTES)} minutos`],
  ])('explica la duración %j', (durationMinutes, message) => {
    expect(errorsOf({ ...VALID, durationMinutes }).durationMinutes).toBe(message);
  });

  it.each<[string, string]>([
    ['', 'Indica cuántas personas caben en el taller'],
    ['2.5', 'La capacidad debe ser un número entero'],
    ['abc', 'La capacidad debe ser un número entero'],
    ['0', 'El taller necesita capacidad para al menos 1 persona'],
    ['-5', 'El taller necesita capacidad para al menos 1 persona'],
    ['201', `El máximo es ${String(MAX_CAPACITY)} personas por taller`],
  ])('explica la capacidad %j', (capacity, message) => {
    expect(errorsOf({ ...VALID, capacity }).capacity).toBe(message);
  });

  it('acumula los errores de todos los campos a la vez', () => {
    expect(Object.keys(errorsOf(EMPTY_WORKSHOP_DRAFT))).toEqual([
      'title',
      'description',
      'date',
      'time',
      'durationMinutes',
      'capacity',
    ]);
  });
});

describe('parseWholeNumber', () => {
  it('lee enteros con espacios y rechaza lo demás', () => {
    expect(parseWholeNumber(' 42 ')).toBe(42);
    expect(parseWholeNumber('-7')).toBe(-7);
    expect(parseWholeNumber('2.5')).toBeNull();
    expect(parseWholeNumber('1e3')).toBeNull();
    expect(parseWholeNumber('abc')).toBeNull();
    expect(parseWholeNumber('')).toBeNull();
  });
});

describe('parseTime', () => {
  it('lee el reloj de 24 horas', () => {
    expect(parseTime('09:15')).toEqual([9, 15]);
    expect(parseTime('23:59')).toEqual([23, 59]);
  });

  it.each(['', '9:15', 'aa:bb', '24:00', '12:60'])('rechaza %j', (value) => {
    expect(parseTime(value)).toBeNull();
  });
});

describe('startOfWorkshop', () => {
  it('arma el inicio en hora local', () => {
    const start = startOfWorkshop('2026-10-10', '15:30');
    expect(start).not.toBeNull();
    expect(start?.getFullYear()).toBe(2026);
    expect(start?.getHours()).toBe(15);
    expect(start?.getMinutes()).toBe(30);
  });

  it('sin día o hora real no hay inicio', () => {
    expect(startOfWorkshop('', '15:30')).toBeNull();
    expect(startOfWorkshop('2026-10-10', '')).toBeNull();
    expect(startOfWorkshop('2026-02-30', '15:30')).toBeNull();
    expect(startOfWorkshop('2026-10-10', '25:00')).toBeNull();
  });
});

describe('draftToNewWorkshop', () => {
  it('convierte el borrador al contrato del API, con textos recortados', () => {
    expect(
      draftToNewWorkshop({
        title: '  Taller de respiración  ',
        description: '  Una sesión práctica para respirar mejor durante la jornada.  ',
        date: '2026-10-10',
        time: '15:00',
        durationMinutes: ' 60 ',
        capacity: ' 25 ',
      }),
    ).toEqual({
      title: 'Taller de respiración',
      description: 'Una sesión práctica para respirar mejor durante la jornada.',
      startsAt: new Date(2026, 9, 10, 15, 0).toISOString(),
      durationMinutes: 60,
      capacity: 25,
    });
  });

  it('sin fecha u hora no hay inicio que convertir', () => {
    expect(() => draftToNewWorkshop({ ...VALID, date: '', time: '' })).toThrow(RangeError);
  });
});
