import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { storeSession } from '@/test/credentials';
import { renderApp } from '@/test/renderRoute';
import { ADMIN_PATHS, workshopRoomPath } from './paths';

/** La descarga de cada sección queda retenida hasta que la prueba la deja llegar. */
const downloads = vi.hoisted(() => {
  function held() {
    let arrive: () => void = () => undefined;
    const arrived = new Promise<void>((resolve) => {
      arrive = resolve;
    });
    return {
      arrived,
      arrive: () => {
        arrive();
      },
    };
  }
  return { admin: held(), rooms: held() };
});

vi.mock('./sections/admin', async (importOriginal) => {
  await downloads.admin.arrived;
  return importOriginal();
});

vi.mock('./sections/rooms', async (importOriginal) => {
  await downloads.rooms.arrived;
  return importOriginal();
});

describe('Carga bajo demanda por sección (HU-FE-24)', () => {
  it('mientras llega una sección, la estructura sigue a la vista y avisa que está cargando', async () => {
    storeSession('ADMIN');
    renderApp(ADMIN_PATHS.employees);

    expect(screen.getByText('Cargando la sección…')).toHaveAttribute('role', 'status');
    expect(screen.getByRole('complementary', { name: 'Barra lateral' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Empleados' })).not.toBeInTheDocument();

    downloads.admin.arrive();

    expect(await screen.findByRole('heading', { level: 1, name: 'Empleados' })).toBeInTheDocument();
    expect(screen.queryByText('Cargando la sección…')).not.toBeInTheDocument();
  });

  it('una sala de video avisa a pantalla completa mientras se descarga', async () => {
    storeSession('EMPLEADO');
    renderApp(workshopRoomPath('EMPLEADO', 'taller-impostor'));

    expect(screen.getByText('Cargando la pantalla…')).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('complementary', { name: 'Barra lateral' })).not.toBeInTheDocument();

    downloads.rooms.arrive();

    expect(await screen.findByRole('link', { name: 'Volver a mis talleres' })).toBeInTheDocument();
    expect(screen.queryByText('Cargando la pantalla…')).not.toBeInTheDocument();
  });
});
