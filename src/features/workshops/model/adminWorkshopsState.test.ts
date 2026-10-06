import { describe, expect, it } from 'vitest';
import type { Workshop } from './workshop';
import { adminWorkshopsReducer, INITIAL_ADMIN_WORKSHOPS_STATE } from './adminWorkshopsState';

const FIRST: Workshop = {
  id: 'taller-1',
  title: 'Taller uno',
  description: 'Descripción del primer taller.',
  startsAt: new Date(2026, 9, 6, 15).toISOString(),
  durationMinutes: 60,
  publishedAt: new Date(2026, 8, 21, 11).toISOString(),
  capacity: 25,
  occupied: 0,
  version: 1,
};

const SECOND: Workshop = { ...FIRST, id: 'taller-2', title: 'Taller dos' };

const loaded = adminWorkshopsReducer(INITIAL_ADMIN_WORKSHOPS_STATE, {
  type: 'load-success',
  requestId: 0,
  workshops: [FIRST],
});

describe('adminWorkshopsReducer', () => {
  it('al empezar a cargar queda en loading y descarta avisos anteriores', () => {
    const state = adminWorkshopsReducer(
      { ...INITIAL_ADMIN_WORKSHOPS_STATE, status: 'ready', pending: [SECOND] },
      { type: 'load-start', requestId: 3 },
    );

    expect(state).toMatchObject({ requestId: 3, status: 'loading', pending: [] });
  });

  it('fusiona lo publicado mientras cargaba, sin duplicarlo', () => {
    const loading = adminWorkshopsReducer(INITIAL_ADMIN_WORKSHOPS_STATE, {
      type: 'load-start',
      requestId: 1,
    });
    const duringLoad = adminWorkshopsReducer(loading, { type: 'published', workshop: SECOND });
    expect(duringLoad.pending).toEqual([SECOND]);
    expect(duringLoad.workshops.map(({ id }) => id)).toEqual(['taller-2']);

    const merged = adminWorkshopsReducer(duringLoad, {
      type: 'load-success',
      requestId: 1,
      workshops: [FIRST, SECOND],
    });
    expect(merged.status).toBe('ready');
    expect(merged.pending).toEqual([]);
    expect(merged.workshops.map(({ id }) => id)).toEqual(['taller-1', 'taller-2']);

    const appended = adminWorkshopsReducer(duringLoad, {
      type: 'load-success',
      requestId: 1,
      workshops: [FIRST],
    });
    expect(appended.workshops.map(({ id }) => id)).toEqual(['taller-1', 'taller-2']);

    const stale = adminWorkshopsReducer(duringLoad, {
      type: 'load-success',
      requestId: 99,
      workshops: [FIRST],
    });
    expect(stale).toBe(duringLoad);
  });

  it('la carga anterior que falla tarde no pisa el estado', () => {
    const started = adminWorkshopsReducer(INITIAL_ADMIN_WORKSHOPS_STATE, {
      type: 'load-start',
      requestId: 7,
    });
    const failed = adminWorkshopsReducer(started, { type: 'load-failure', requestId: 7 });
    expect(failed.status).toBe('error');

    expect(adminWorkshopsReducer(failed, { type: 'load-failure', requestId: 1 })).toBe(failed);
  });

  it('agrega cada taller una sola vez, cargado o no', () => {
    const added = adminWorkshopsReducer(loaded, { type: 'published', workshop: SECOND });
    expect(added.workshops.map(({ id }) => id)).toEqual(['taller-1', 'taller-2']);
    expect(added.pending).toEqual([]);

    const repeated = adminWorkshopsReducer(added, { type: 'published', workshop: SECOND });
    expect(repeated.workshops).toBe(added.workshops);
    expect(repeated.workshops).toHaveLength(2);
  });
});
