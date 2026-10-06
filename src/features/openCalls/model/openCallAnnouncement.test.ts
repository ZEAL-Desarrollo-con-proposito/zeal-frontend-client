import { describe, expect, it } from 'vitest';
import type { Project } from '@/features/projects/model/project';
import type { Workshop } from '@/features/workshops/model/workshop';
import { projectAnnouncement, workshopAnnouncement } from './openCallAnnouncement';

const NOW = new Date(2026, 8, 23, 9, 20).getTime();

const PROJECT: Project = {
  id: 'proyecto-guardia-datos',
  title: 'Data Platform · Turno de guardia',
  area: 'Datos',
  cohort: 'Rotación trimestral',
  summary: 'Acompañar el oncall con un mentor durante 6 semanas.',
  capacity: 4,
  occupied: 2,
  version: 7,
  closesAt: new Date(2026, 8, 26, 14, 20).toISOString(),
};

const WORKSHOP: Workshop = {
  id: 'taller-pausas-activas',
  title: 'Pausas activas y respiración',
  description: 'Aprende técnicas breves de respiración y pausas activas para tu jornada.',
  startsAt: new Date(2026, 8, 30, 15).toISOString(),
  durationMinutes: 60,
  publishedAt: new Date(2026, 8, 21, 11).toISOString(),
  capacity: 30,
  occupied: 12,
  version: 1,
};

describe('projectAnnouncement', () => {
  it('anuncia un proyecto abierto con sus cupos y su enlace', () => {
    expect(projectAnnouncement(PROJECT, NOW)).toEqual({
      key: 'proyecto:proyecto-guardia-datos',
      toast: {
        tone: 'info',
        title: 'Convocatoria abierta: Data Platform · Turno de guardia',
        message: 'Quedan 2 de 4 cupos. Cierra en 3 días.',
        action: { label: 'Ver proyecto', to: '/empleado/proyectos/proyecto-guardia-datos' },
      },
    });
  });

  it('no anuncia un proyecto que ya cerró', () => {
    const closed = { ...PROJECT, closesAt: new Date(2026, 8, 23, 8).toISOString() };
    expect(projectAnnouncement(closed, NOW)).toBeNull();
  });

  it('no anuncia un proyecto sin cupos', () => {
    expect(projectAnnouncement({ ...PROJECT, occupied: 4 }, NOW)).toBeNull();
  });
});

describe('workshopAnnouncement', () => {
  it('anuncia un taller con su horario, capacidad y enlace', () => {
    expect(workshopAnnouncement(WORKSHOP, NOW)).toEqual({
      key: 'taller:taller-pausas-activas',
      toast: {
        tone: 'info',
        title: 'Convocatoria abierta: Pausas activas y respiración',
        message: 'Miércoles, 30 de septiembre · 15:00 – 16:00. Capacidad para 30 personas.',
        action: { label: 'Ver taller', to: '/empleado/talleres?taller=taller-pausas-activas' },
      },
    });
  });

  it('no anuncia un taller que ya empezó', () => {
    expect(
      workshopAnnouncement({ ...WORKSHOP, startsAt: new Date(NOW).toISOString() }, NOW),
    ).toBeNull();
    expect(
      workshopAnnouncement({ ...WORKSHOP, startsAt: new Date(2026, 8, 23, 8).toISOString() }, NOW),
    ).toBeNull();
  });

  it('no anuncia un taller sin cupos', () => {
    expect(workshopAnnouncement({ ...WORKSHOP, occupied: 30 }, NOW)).toBeNull();
  });
});
