import { describe, expect, it } from 'vitest';
import type { ProjectDetail } from './project';
import {
  closingOf,
  isProject,
  isProjectDetail,
  projectInitials,
  projectTone,
  spotsLabel,
} from './project';

const NOW = new Date(2026, 8, 23, 9, 20).getTime();

const DETAIL: ProjectDetail = {
  id: 'proyecto-1',
  title: 'Squad de Observabilidad',
  area: 'Plataforma',
  cohort: 'Semilla 2026-2',
  summary: 'Instrumentar trazas.',
  capacity: 3,
  occupied: 1,
  version: 4,
  closesAt: new Date(2026, 8, 25, 18).toISOString(),
  description: ['Párrafo'],
  requirements: ['Requisito'],
  skills: ['Habilidad'],
};

describe('contrato de convocatorias', () => {
  it('acepta la convocatoria y su detalle', () => {
    expect(isProject(DETAIL)).toBe(true);
    expect(isProjectDetail(DETAIL)).toBe(true);
  });

  it.each<[string, unknown]>([
    ['un valor que no es objeto', 'proyecto'],
    ['cupos negativos', { ...DETAIL, occupied: -1 }],
    ['cupos fraccionarios', { ...DETAIL, capacity: 2.5 }],
    ['sin versión', { ...DETAIL, version: undefined }],
    ['sin título', { ...DETAIL, title: 3 }],
    ['una fecha de cierre inválida', { ...DETAIL, closesAt: 'pronto' }],
  ])('rechaza %s', (_case, value) => {
    expect(isProject(value)).toBe(false);
  });

  it('el detalle exige descripción, requisitos y habilidades como listas de texto', () => {
    expect(isProjectDetail({ ...DETAIL, description: 'texto' })).toBe(false);
    expect(isProjectDetail({ ...DETAIL, requirements: [1] })).toBe(false);
    expect(isProjectDetail({ ...DETAIL, skills: undefined })).toBe(false);
    expect(isProjectDetail({ ...DETAIL, title: undefined })).toBe(false);
  });
});

describe('cupos', () => {
  it('describe los cupos en singular, en plural o agotados', () => {
    expect(spotsLabel({ capacity: 8, occupied: 5, version: 1 })).toBe('Quedan 3 de 8 cupos');
    expect(spotsLabel({ capacity: 6, occupied: 5, version: 1 })).toBe('Queda 1 de 6 cupos');
    expect(spotsLabel({ capacity: 3, occupied: 3, version: 1 })).toBe(
      'Sin cupos · 3 de 3 ocupados',
    );
  });
});

describe('closingOf', () => {
  const at = (day: number, hour = 18) => new Date(2026, 8, day, hour).toISOString();

  it.each([
    [at(23), 'Cierra hoy', true],
    [at(24), 'Cierra mañana', true],
    [at(26), 'Cierra en 3 días', true],
    [at(28), 'Cierra en 5 días', false],
  ])('%s → "%s"', (closesAt, label, urgent) => {
    expect(closingOf(closesAt, NOW)).toEqual({ label, urgent, closed: false });
  });

  it('una convocatoria vencida está cerrada', () => {
    expect(closingOf(at(23, 9), NOW)).toEqual({ label: 'Cerrada', urgent: true, closed: true });
  });
});

describe('marca de la convocatoria', () => {
  it('usa las iniciales de las dos primeras palabras con significado', () => {
    expect(projectInitials('Squad de Observabilidad')).toBe('SO');
    expect(projectInitials('Data Platform · Turno de guardia')).toBe('DP');
    expect(projectInitials('  mentoría inversa Gen Z')).toBe('MI');
  });

  it('asigna un color estable a cada convocatoria', () => {
    expect(projectTone('a')).toBe('mauve');
    expect(projectTone('b')).toBe('teal');
    expect(projectTone('c')).toBe('sage');
    expect(projectTone('a')).toBe(projectTone('a'));
  });
});
