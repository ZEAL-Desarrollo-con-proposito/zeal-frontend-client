import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '@/features/auth/context/AuthProvider';
import { useProjects } from './useProjects';

describe('useProjects', () => {
  it('sin sesión no hay canal de la organización ni convocatorias', async () => {
    const { result } = renderHook(() => useProjects(), { wrapper: AuthProvider });

    await waitFor(() => {
      expect(result.current.status).not.toBe('loading');
    });
    expect(result.current.projects).toEqual([]);
  });
});
