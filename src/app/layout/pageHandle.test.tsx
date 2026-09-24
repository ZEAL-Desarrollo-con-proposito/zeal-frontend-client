import { render, screen } from '@testing-library/react';
import type { UIMatch } from 'react-router';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '@/features/auth/context/AuthProvider';
import { storeSession } from '@/test/credentials';
import { AppLayout } from './AppLayout';
import { findPageTitle } from './pageHandle';

function match(handle: unknown): UIMatch {
  return { id: 'ruta', pathname: '/', params: {}, loaderData: undefined, handle };
}

describe('findPageTitle', () => {
  it('usa el título de la ruta más específica que lo declara', () => {
    expect(
      findPageTitle([
        match({ title: 'Empleado' }),
        match(undefined),
        match({ title: 'Mis citas' }),
      ]),
    ).toBe('Mis citas');
  });

  it('devuelve null si ninguna ruta declara un título válido', () => {
    expect(findPageTitle([match(undefined), match({ title: 42 }), match('texto')])).toBeNull();
  });
});

describe('AppLayout sin título de página', () => {
  it('usa el nombre del rol en la barra superior y en la pestaña', () => {
    storeSession('EMPLEADO');
    const router = createMemoryRouter(
      [{ element: <AppLayout />, children: [{ path: '/empleado/extra', element: <p>Extra</p> }] }],
      { initialEntries: ['/empleado/extra'] },
    );

    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(screen.getByText('Extra')).toBeInTheDocument();
    expect(document.title).toBe('Empleado · ZEAL');
  });
});
