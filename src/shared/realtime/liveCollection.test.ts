import { describe, expect, it } from 'vitest';
import type { LiveCollectionState } from './liveCollection';
import { INITIAL_LIVE_COLLECTION, liveCollectionReducer } from './liveCollection';

interface Item {
  id: string;
  version: number;
  label: string;
}

const INITIAL = INITIAL_LIVE_COLLECTION as LiveCollectionState<Item>;

function item(id: string, version = 1, label = `v${String(version)}`): Item {
  return { id, version, label };
}

describe('liveCollectionReducer', () => {
  it('solo la última carga cambia el estado', () => {
    const first = liveCollectionReducer(INITIAL, { type: 'load-start', requestId: 1 });
    const second = liveCollectionReducer(first, { type: 'load-start', requestId: 2 });

    expect(liveCollectionReducer(second, { type: 'load-success', requestId: 1, items: [] })).toBe(
      second,
    );
    expect(liveCollectionReducer(second, { type: 'load-failure', requestId: 1 })).toBe(second);
    expect(liveCollectionReducer(second, { type: 'load-failure', requestId: 2 }).status).toBe(
      'error',
    );
  });

  it('no pierde lo que llega en vivo durante la carga', () => {
    const loading = liveCollectionReducer(INITIAL, { type: 'load-start', requestId: 1 });
    const live = liveCollectionReducer(loading, { type: 'received', item: item('c') });

    const ready = liveCollectionReducer(live, {
      type: 'load-success',
      requestId: 1,
      items: [item('a'), item('b')],
    });

    expect(ready.status).toBe('ready');
    expect(ready.items.map(({ id }) => id)).toEqual(['a', 'b', 'c']);
    expect(ready.pending).toEqual([]);
  });

  it('se queda con la versión más nueva: un aviso atrasado o repetido no lo devuelve atrás', () => {
    const ready = liveCollectionReducer(
      { ...INITIAL, status: 'ready' },
      { type: 'received', item: item('a', 2) },
    );

    const stale = liveCollectionReducer(ready, { type: 'received', item: item('a', 1) });
    const repeated = liveCollectionReducer(ready, { type: 'received', item: item('a', 2) });
    const newer = liveCollectionReducer(ready, { type: 'received', item: item('a', 3) });

    expect(stale.items).toEqual([item('a', 2)]);
    expect(repeated.items).toEqual([item('a', 2)]);
    expect(newer.items).toEqual([item('a', 3)]);
  });
});
