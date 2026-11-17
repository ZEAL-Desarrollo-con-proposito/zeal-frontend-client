import { describe, expect, it } from 'vitest';
import type { Project } from '@/features/projects/model/project';
import type { Workshop } from '@/features/workshops/model/workshop';
import { percentLabel, spotsTotals, summarizeProjects, summarizeWorkshops } from './report';

const NOW = Date.parse('2026-11-16T15:00:00Z');
const DAY = 86_400_000;

function project(id: string, capacity: number, occupied: number, closesInDays: number): Project {
  return {
    id,
    title: `Convocatoria ${id}`,
    area: 'Datos',
    cohort: 'Q4',
    summary: 'Resumen',
    capacity,
    occupied,
    version: occupied,
    closesAt: new Date(NOW + closesInDays * DAY).toISOString(),
  };
}

function workshop(id: string, capacity: number, occupied: number, startsInDays: number): Workshop {
  return {
    id,
    title: `Taller ${id}`,
    description: 'Descripción',
    capacity,
    occupied,
    version: occupied,
    startsAt: new Date(NOW + startsInDays * DAY).toISOString(),
    durationMinutes: 60,
    publishedAt: new Date(NOW - 10 * DAY).toISOString(),
  };
}

describe('reportes agregados de la empresa', () => {
  it('suma los cupos y calcula el porcentaje ocupado', () => {
    expect(
      spotsTotals([
        { capacity: 10, occupied: 4, version: 1 },
        { capacity: 5, occupied: 5, version: 1 },
      ]),
    ).toEqual({
      occupied: 9,
      capacity: 15,
      percent: 60,
    });
  });

  it('sin cupos ofrecidos el porcentaje es 0 y no se divide entre cero', () => {
    expect(spotsTotals([])).toEqual({ occupied: 0, capacity: 0, percent: 0 });
  });

  it('cuenta convocatorias abiertas, cerradas y sin cupos', () => {
    const report = summarizeProjects(
      [
        project('a', 10, 3, 5),
        project('b', 4, 4, 2),
        project('c', 6, 6, -1),
        project('d', 8, 1, -9),
      ],
      NOW,
    );

    expect(report).toMatchObject({ published: 4, open: 2, closed: 2, full: 1 });
    expect(report.spots).toEqual({ occupied: 14, capacity: 28, percent: 50 });
  });

  it('una convocatoria cerrada sin cupos no cuenta como "sin cupos" abierta', () => {
    expect(summarizeProjects([project('c', 6, 6, -1)], NOW)).toMatchObject({
      open: 0,
      closed: 1,
      full: 0,
    });
  });

  it('separa talleres próximos de los ya realizados', () => {
    const report = summarizeWorkshops(
      [workshop('a', 10, 5, 3), workshop('b', 10, 10, -2), workshop('c', 20, 5, 20)],
      NOW,
    );

    expect(report).toMatchObject({ published: 3, upcoming: 2, held: 1 });
    expect(report.spots).toEqual({ occupied: 20, capacity: 40, percent: 50 });
  });

  it('sin convocatorias ni talleres todo queda en cero', () => {
    expect(summarizeProjects([], NOW)).toEqual({
      published: 0,
      open: 0,
      closed: 0,
      full: 0,
      spots: { occupied: 0, capacity: 0, percent: 0 },
    });
    expect(summarizeWorkshops([], NOW).published).toBe(0);
  });

  it('da formato al porcentaje', () => {
    expect(percentLabel(62)).toBe('62 %');
  });
});
