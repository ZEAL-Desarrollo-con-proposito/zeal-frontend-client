import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fetchReducer, useFetch } from './useFetch';

describe('fetchReducer', () => {
  const loading = { requestId: 2, status: 'loading' as const, data: 'anterior' };

  it('ignora la respuesta o el fallo de una petición que ya no es la vigente', () => {
    expect(fetchReducer(loading, { type: 'success', requestId: 1, data: 'atrasada' })).toBe(
      loading,
    );
    expect(fetchReducer(loading, { type: 'failure', requestId: 1 })).toBe(loading);
  });

  it('conserva los datos anteriores mientras carga y si la petición falla', () => {
    expect(fetchReducer(loading, { type: 'failure', requestId: 2 })).toEqual({
      ...loading,
      status: 'error',
    });
    expect(fetchReducer({ ...loading, status: 'ready' }, { type: 'start', requestId: 3 })).toEqual({
      requestId: 3,
      status: 'loading',
      data: 'anterior',
    });
  });
});

describe('useFetch', () => {
  it('cancela la petición anterior cuando cambia la clave', async () => {
    const signals: AbortSignal[] = [];
    const load = vi.fn((signal: AbortSignal) => {
      signals.push(signal);
      return Promise.resolve(signals.length);
    });
    const { result, rerender } = renderHook(({ key }) => useFetch(key, load), {
      initialProps: { key: 'semana-1' },
    });
    await waitFor(() => {
      expect(result.current.data).toBe(1);
    });

    rerender({ key: 'semana-2' });

    expect(signals[0]?.aborted).toBe(true);
    await waitFor(() => {
      expect(result.current).toMatchObject({ status: 'ready', data: 2 });
    });
  });

  it('reintenta tras un fallo con reload', async () => {
    const load = vi
      .fn<(signal: AbortSignal) => Promise<string>>()
      .mockRejectedValueOnce(new Error('caída'))
      .mockResolvedValueOnce('agenda');
    const { result } = renderHook(() => useFetch('semana', load));
    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({ status: 'ready', data: 'agenda' });
    });
    expect(load).toHaveBeenCalledTimes(2);
  });
});
