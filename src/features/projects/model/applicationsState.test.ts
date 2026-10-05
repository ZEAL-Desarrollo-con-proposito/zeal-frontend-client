import { describe, expect, it } from 'vitest';
import type { Application } from './application';
import { applicationsReducer, INITIAL_APPLICATIONS_STATE } from './applicationsState';

function application(id: string, version = 1, hour = 9): Application {
  return {
    id,
    projectId: `proyecto-${id}`,
    projectTitle: `Convocatoria ${id}`,
    status: 'EN_ESPERA',
    waitlistPosition: 1,
    createdAt: new Date(2026, 8, 23, hour).toISOString(),
    version,
  };
}

describe('applicationsReducer', () => {
  it('solo la última carga cambia el estado', () => {
    const first = applicationsReducer(INITIAL_APPLICATIONS_STATE, {
      type: 'load-start',
      requestId: 1,
    });
    const second = applicationsReducer(first, { type: 'load-start', requestId: 2 });

    expect(
      applicationsReducer(second, { type: 'load-success', requestId: 1, applications: [] }),
    ).toBe(second);
    expect(applicationsReducer(second, { type: 'load-failure', requestId: 1 })).toBe(second);
    expect(applicationsReducer(second, { type: 'load-failure', requestId: 2 }).status).toBe(
      'error',
    );
  });

  it('ordena por fecha y no pierde lo que llega en vivo durante la carga', () => {
    const loading = applicationsReducer(INITIAL_APPLICATIONS_STATE, {
      type: 'load-start',
      requestId: 1,
    });
    const live = applicationsReducer(loading, {
      type: 'received',
      application: application('c', 1, 11),
    });

    const ready = applicationsReducer(live, {
      type: 'load-success',
      requestId: 1,
      applications: [application('a', 1, 8), application('b', 1, 10)],
    });

    expect(ready.status).toBe('ready');
    expect(ready.applications.map(({ id }) => id)).toEqual(['c', 'b', 'a']);
    expect(ready.pending).toEqual([]);
  });

  it('se queda con la versión más nueva: un aviso atrasado o repetido no la devuelve atrás', () => {
    const ready = applicationsReducer(
      { ...INITIAL_APPLICATIONS_STATE, status: 'ready' },
      { type: 'received', application: application('a', 2) },
    );
    const accepted = {
      ...application('a', 3),
      status: 'ACEPTADA' as const,
      waitlistPosition: null,
    };

    const stale = applicationsReducer(ready, {
      type: 'received',
      application: application('a', 1),
    });
    const repeated = applicationsReducer(ready, {
      type: 'received',
      application: application('a', 2),
    });
    const newer = applicationsReducer(ready, { type: 'received', application: accepted });

    expect(stale.applications).toEqual([application('a', 2)]);
    expect(repeated.applications).toEqual([application('a', 2)]);
    expect(newer.applications).toEqual([accepted]);
  });
});
