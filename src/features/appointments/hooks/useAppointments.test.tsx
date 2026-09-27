import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { useAppointmentsView } from './useAppointmentsView'; // ← ajusta al nombre real

/** Pequeño hook auxiliar para leer la URL desde el test. */
function useCurrentSearch() {
  return useLocation().search;
}

function renderAt(initialEntry: string) {
  return renderHook(
    () => ({
      view: useAppointmentsView(),
      search: useCurrentSearch(),
    }),
    {
      wrapper: ({ children }) => {
        return (
          <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
              <Route path="/empleado/mis-citas" element={<>{children}</>} />
            </Routes>
          </MemoryRouter>
        );
      },
    },
  );
}

describe('useAppointmentsView', () => {
  it('usa "proximas" cuando no hay vista en la URL', () => {
    const { result } = renderAt('/empleado/mis-citas');
    expect(result.current.view[0]).toBe('proximas');
  });

  it('lee la vista de la URL si es válida', () => {
    const { result } = renderAt('/empleado/mis-citas?vista=historial');
    expect(result.current.view[0]).toBe('historial');
  });

  it('cae a "proximas" si la vista de la URL no es válida', () => {
    const { result } = renderAt('/empleado/mis-citas?vista=otra');
    expect(result.current.view[0]).toBe('proximas');
  });

  it('actualiza la URL al cambiar de vista, preservando otros parámetros', () => {
    const { result } = renderAt('/empleado/mis-citas?otro=1');

    act(() => {
      result.current.view[1]('canceladas');
    });

    expect(result.current.view[0]).toBe('canceladas');
    expect(result.current.search).toContain('otro=1');
    expect(result.current.search).toContain('vista=canceladas');
  });

  it('reemplaza la entrada del historial en lugar de apilar una nueva', () => {
    const { result } = renderAt('/empleado/mis-citas');

    act(() => {
      result.current.view[1]('historial');
    });

    expect(result.current.search).toBe('?vista=historial');
  });
});
