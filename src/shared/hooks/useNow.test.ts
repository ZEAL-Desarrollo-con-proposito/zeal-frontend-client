import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NOW_REFRESH_MS, useNow } from './useNow';

describe('useNow', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('se actualiza sola cada intervalo y deja de hacerlo al desmontarse', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 23, 9, 49));
    const { result, unmount } = renderHook(() => useNow());
    const initial = result.current;

    act(() => {
      vi.advanceTimersByTime(NOW_REFRESH_MS);
    });
    expect(result.current).toBe(initial + NOW_REFRESH_MS);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('acepta otro periodo de refresco', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useNow(1000));
    const initial = result.current;

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current).toBe(initial + 1000);
  });
});
