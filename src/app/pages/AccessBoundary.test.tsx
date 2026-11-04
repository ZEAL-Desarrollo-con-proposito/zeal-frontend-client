import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AccessBoundary } from './AccessBoundary';

function BrokenPage(): never {
  throw new Error('Fallo inesperado al pintar la pantalla');
}

describe('AccessBoundary', () => {
  it('deja pasar a la frontera de la raíz cualquier error que no sea un 403 o un 404', () => {
    // React y el router informan el error capturado por consola; aquí se espera.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const router = createMemoryRouter([
      {
        path: '/',
        errorElement: <p>Frontera de la raíz</p>,
        children: [{ index: true, errorElement: <AccessBoundary />, element: <BrokenPage /> }],
      },
    ]);

    render(<RouterProvider router={router} />);

    expect(screen.getByText('Frontera de la raíz')).toBeInTheDocument();
  });
});
