import { render, renderHook, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { UnexpectedErrorPage } from '@/app/pages/UnexpectedErrorPage';
import { AuthProvider } from '../context/AuthProvider';
import { useAuth, useCurrentUser } from './useAuth';

describe('useAuth', () => {
  it('exige estar dentro de <AuthProvider>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth debe usarse dentro de <AuthProvider>',
    );
  });

  it('useCurrentUser exige una sesión activa', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useCurrentUser(), { wrapper: AuthProvider })).toThrow(
      'No hay una sesión activa',
    );
  });
});

describe('UnexpectedErrorPage', () => {
  it('ofrece volver al inicio ante un error no controlado', () => {
    const router = createMemoryRouter([{ path: '/', element: <UnexpectedErrorPage /> }]);
    render(<RouterProvider router={router} />);

    expect(screen.getByRole('heading', { name: 'Algo salió mal' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
  });
});
