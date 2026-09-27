import { describe, expect, it } from 'vitest';
import type { Psychologist } from './psychologist';
import {
  availabilityOf,
  avatarToneFor,
  filterDirectory,
  hasFilters,
  isPsychologist,
  topicsOf,
} from './psychologist';

const at = (day: number, hour: number) => new Date(2026, 8, day, hour);
const NOW = at(23, 9).getTime();

function psychologist(overrides: Partial<Psychologist> = {}): Psychologist {
  return {
    id: 'usr-psicologo-001',
    fullName: 'Laura Martínez',
    title: 'Psicóloga clínica',
    focusAreas: ['Ansiedad laboral', 'Burnout'],
    nextFreeSlot: { startsAt: at(23, 10).toISOString(), endsAt: at(23, 11).toISOString() },
    ...overrides,
  };
}

describe('isPsychologist', () => {
  it('acepta un psicólogo con o sin próximo bloque libre', () => {
    expect(isPsychologist(psychologist())).toBe(true);
    expect(isPsychologist(psychologist({ nextFreeSlot: null }))).toBe(true);
  });

  it.each<[string, unknown]>([
    ['un valor que no es objeto', 'Laura'],
    ['un id no textual', { ...psychologist(), id: 1 }],
    ['un nombre ausente', { ...psychologist(), fullName: undefined }],
    ['un título ausente', { ...psychologist(), title: null }],
    ['temas que no son lista', { ...psychologist(), focusAreas: 'Duelo' }],
    ['temas no textuales', { ...psychologist(), focusAreas: [3] }],
    ['un próximo bloque ausente', { ...psychologist(), nextFreeSlot: undefined }],
    ['un próximo bloque sin fin', { ...psychologist(), nextFreeSlot: { startsAt: 'x' } }],
    [
      'un próximo bloque con fecha inválida',
      { ...psychologist(), nextFreeSlot: { startsAt: 'hoy', endsAt: 'mañana' } },
    ],
  ])('rechaza %s', (_case, value) => {
    expect(isPsychologist(value)).toBe(false);
  });
});

describe('availabilityOf', () => {
  it('destaca a quien tiene un bloque libre hoy', () => {
    expect(availabilityOf(psychologist(), NOW)).toEqual({
      today: true,
      badge: { label: 'Disponible hoy', tone: 'sage' },
      next: 'Hoy · 10:00',
    });
  });

  it('muestra la agenda llena y el próximo día cuando hoy no hay bloques', () => {
    const later = psychologist({
      nextFreeSlot: { startsAt: at(28, 9).toISOString(), endsAt: at(28, 10).toISOString() },
    });

    expect(availabilityOf(later, NOW)).toEqual({
      today: false,
      badge: { label: 'Agenda llena', tone: 'mauve' },
      next: 'Lun 28 · 9:00',
    });
  });

  it('avisa cuando el psicólogo aún no abre bloques', () => {
    expect(availabilityOf(psychologist({ nextFreeSlot: null }), NOW)).toEqual({
      today: false,
      badge: { label: 'Sin bloques', tone: 'neutral' },
      next: 'Aún no abre bloques',
    });
  });
});

describe('topicsOf', () => {
  it('reúne los temas sin repetir y en orden alfabético', () => {
    expect(
      topicsOf([
        psychologist({ focusAreas: ['Sueño', 'Ansiedad laboral'] }),
        psychologist({ focusAreas: ['Duelo', 'Ansiedad laboral'] }),
      ]),
    ).toEqual(['Ansiedad laboral', 'Duelo', 'Sueño']);
  });
});

describe('filterDirectory', () => {
  const laura = psychologist();
  const andres = psychologist({
    id: 'usr-psicologo-002',
    fullName: 'Andrés Rojas',
    title: 'Psicólogo organizacional',
    focusAreas: ['Carrera'],
    nextFreeSlot: null,
  });
  const directory = [laura, andres];
  const none = { query: '', topic: null, onlyToday: false };

  it('sin filtros muestra a todos', () => {
    expect(filterDirectory(directory, none, NOW)).toEqual(directory);
    expect(hasFilters(none)).toBe(false);
  });

  it.each([
    ['el nombre, sin importar tildes ni mayúsculas', '  ANDRES '],
    ['el título', 'organizacional'],
    ['un tema', 'carrera'],
  ])('busca por %s', (_case, query) => {
    expect(filterDirectory(directory, { ...none, query }, NOW)).toEqual([andres]);
    expect(hasFilters({ ...none, query })).toBe(true);
  });

  it('filtra por tema y por disponibilidad de hoy', () => {
    expect(filterDirectory(directory, { ...none, topic: 'Burnout' }, NOW)).toEqual([laura]);
    expect(filterDirectory(directory, { ...none, onlyToday: true }, NOW)).toEqual([laura]);
    expect(hasFilters({ ...none, topic: 'Burnout' })).toBe(true);
    expect(hasFilters({ ...none, onlyToday: true })).toBe(true);
  });

  it('combina los filtros', () => {
    expect(
      filterDirectory(directory, { query: 'laura', topic: 'Carrera', onlyToday: false }, NOW),
    ).toEqual([]);
  });
});

describe('avatarToneFor', () => {
  it('da siempre el mismo tono de la marca a la misma persona', () => {
    const tones = ['usr-psicologo-001', 'usr-psicologo-002', 'usr-psicologo-003'].map(
      avatarToneFor,
    );

    expect(new Set(tones)).toEqual(new Set(['sage', 'teal', 'mauve']));
    expect(avatarToneFor('usr-psicologo-001')).toBe(tones[0]);
  });
});
