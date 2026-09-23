import { renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderRoute } from '@/test/renderRoute';
import { useAuth } from './useAuth';

describe('useAuth', () => {
  it('exige estar dentro de <AuthProvider>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth debe usarse dentro de <AuthProvider>',
    );
  });

  it('muestra la página de error si una vista con sesión se abre sin sesión', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderRoute('/empleado/inicio');

    expect(screen.getByRole('heading', { name: 'Algo salió mal' })).toBeInTheDocument();
  });
});
