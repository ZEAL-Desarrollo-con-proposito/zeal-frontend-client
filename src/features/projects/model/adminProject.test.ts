import { describe, expect, it } from 'vitest';
import type { AdminProject } from './adminProject';
import { compareByNewest, describeDay, isAdminProject, projectBadge } from './adminProject';
import { isProjectPublishedEvent } from './adminProjectEvent';
import { adminProjectsReducer, INITIAL_ADMIN_PROJECTS_STATE } from './adminProjectsState';

const NOW = new Date(2026, 8, 23, 9, 20).getTime();
const PROJECT: AdminProject = {
  id: 'proyecto-1',
  title: 'Piloto',
  area: 'Cultura',
  cohort: 'Semilla 2026-2',
  summary: 'Resumen del proyecto piloto.',
  capacity: 5,
  occupied: 2,
  version: 1,
  closesAt: new Date(2026, 9, 15, 23, 59, 59).toISOString(),
  publishedAt: new Date(2026, 8, 23, 9, 0).toISOString(),
};

describe('proyecto del administrador', () => {
  it('valida el contrato: el del catálogo más la fecha de publicación', () => {
    expect(isAdminProject(PROJECT)).toBe(true);
    expect(isAdminProject({ ...PROJECT, publishedAt: 'ayer' })).toBe(false);
    expect(isAdminProject({ ...PROJECT, capacity: '5' })).toBe(false);
    expect(isAdminProject(null)).toBe(false);
  });

  it('distingue abierta, sin cupos y cerrada', () => {
    expect(projectBadge(PROJECT, NOW)).toEqual({ label: 'Abierta', tone: 'sage' });
    expect(projectBadge({ ...PROJECT, occupied: 5 }, NOW)).toEqual({
      label: 'Sin cupos',
      tone: 'coral',
    });
    expect(
      projectBadge({ ...PROJECT, closesAt: new Date(2026, 8, 1).toISOString() }, NOW).label,
    ).toBe('Cerrada');
    expect(describeDay(PROJECT.closesAt)).toBe('jueves, 15 de octubre');
  });

  it('ordena del más reciente al más antiguo', () => {
    const older = { ...PROJECT, id: 'proyecto-0', publishedAt: new Date(2026, 8, 1).toISOString() };
    expect(compareByNewest(PROJECT, older)).toBeLessThan(0);
    expect(compareByNewest(older, PROJECT)).toBeGreaterThan(0);
    expect(compareByNewest(PROJECT, PROJECT)).toBe(0);
  });

  it('reconoce solo eventos de publicación bien formados', () => {
    expect(isProjectPublishedEvent({ type: 'PUBLICADO', project: PROJECT })).toBe(true);
    expect(isProjectPublishedEvent({ type: 'BORRADO', project: PROJECT })).toBe(false);
    expect(isProjectPublishedEvent({ type: 'PUBLICADO', project: { id: 'x' } })).toBe(false);
  });
});

describe('estado de proyectos del administrador', () => {
  const ready = adminProjectsReducer(
    adminProjectsReducer(INITIAL_ADMIN_PROJECTS_STATE, { type: 'load-start', requestId: 1 }),
    { type: 'load-success', requestId: 1, projects: [PROJECT] },
  );

  it('publicar dos veces el mismo proyecto no lo duplica', () => {
    const once = adminProjectsReducer(ready, { type: 'published', project: PROJECT });
    expect(adminProjectsReducer(once, { type: 'published', project: PROJECT }).projects).toEqual([
      PROJECT,
    ]);
  });

  it('descarta la respuesta de una carga que ya no es la vigente', () => {
    const loading = adminProjectsReducer(ready, { type: 'load-start', requestId: 2 });
    expect(
      adminProjectsReducer(loading, { type: 'load-success', requestId: 1, projects: [] }),
    ).toBe(loading);
    expect(adminProjectsReducer(loading, { type: 'load-failure', requestId: 1 })).toBe(loading);
  });

  it('no pierde lo publicado mientras la lista carga', () => {
    const loading = adminProjectsReducer(INITIAL_ADMIN_PROJECTS_STATE, {
      type: 'load-start',
      requestId: 1,
    });
    const mine = { ...PROJECT, id: 'proyecto-9' };
    const during = adminProjectsReducer(loading, { type: 'published', project: mine });
    const done = adminProjectsReducer(during, {
      type: 'load-success',
      requestId: 1,
      projects: [PROJECT],
    });
    expect(done.projects.map(({ id }) => id).sort((a, b) => a.localeCompare(b))).toEqual([
      'proyecto-1',
      'proyecto-9',
    ]);
  });
});
