import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ADMIN_PATHS } from '@/app/paths';
import { sessionStore } from '@/features/auth/storage/sessionStore';
import { createMockToken } from '@/mocks/mockToken';
import { SEED_USERS } from '@/mocks/seedUsers';
import { server } from '@/mocks/server';
import { storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import { EMPLOYEES_ENDPOINT } from './api/employeesApi';

function directory() {
  return within(screen.getByRole('list', { name: 'Empleados de la empresa' }));
}

function names() {
  return directory()
    .getAllByRole('listitem')
    .map((item) => item.querySelector('p')?.textContent);
}

/** Inicia sesión como la administradora de Órbita Labs, la segunda empresa cliente. */
function openAsOrbitaAdmin() {
  const admin = SEED_USERS.find(({ id }) => id === 'usr-admin-002');
  if (admin === undefined) {
    throw new Error('Falta la administradora de Órbita Labs');
  }
  sessionStore.save({
    accessToken: createMockToken(admin),
    user: admin,
    expiresAt: Date.now() + 3_600_000,
  });
  return renderRoute(ADMIN_PATHS.employees);
}

describe('Empleados de la empresa', () => {
  it('la empresa ve a sus empleados en orden alfabético, solo con datos de contacto', async () => {
    storeSession('ADMIN');
    const { user } = renderRoute(ADMIN_PATHS.workshops);

    await user.click(screen.getByRole('link', { name: 'Empleados' }));

    expect(await screen.findByRole('heading', { name: 'Empleados' })).toBeInTheDocument();
    await screen.findByRole('list', { name: 'Empleados de la empresa' });
    expect(names()).toEqual(['Camilo Rincón', 'David Cajamarca', 'Mariana Torres', 'Sofía Mejía']);
    expect(
      screen.getByText('Personas de Nexura S.A.S. con cuenta en ZEAL · 4 personas'),
    ).toBeInTheDocument();
    expect(directory().getByRole('link', { name: 'sofia.mejia@nexura.co' })).toHaveAttribute(
      'href',
      'mailto:sofia.mejia@nexura.co',
    );
    expect(
      screen.getByText(/Las citas, mensajes y el bienestar de cada persona son confidenciales/),
    ).toBeInTheDocument();
  });

  it('busca por nombre o correo sin importar tildes ni mayúsculas', async () => {
    storeSession('ADMIN');
    const { user } = renderRoute(ADMIN_PATHS.employees);
    await screen.findByRole('list', { name: 'Empleados de la empresa' });
    const search = screen.getByRole('searchbox', { name: 'Buscar empleados' });

    await user.type(search, 'SOFIA');
    expect(names()).toEqual(['Sofía Mejía']);

    await user.clear(search);
    await user.type(search, 'david.caja');
    expect(names()).toEqual(['David Cajamarca']);

    await user.clear(search);
    await user.type(search, 'nadie ');
    expect(screen.getByText('Nadie coincide con «nadie».')).toBeInTheDocument();
  });

  it('otra empresa ve solo a los suyos', async () => {
    openAsOrbitaAdmin();

    await screen.findByRole('list', { name: 'Empleados de la empresa' });
    expect(names()).toEqual([
      'Andrea Gómez',
      'Felipe Restrepo',
      'Natalia Vargas',
      'Santiago Herrera',
    ]);
    expect(screen.queryByText('David Cajamarca')).not.toBeInTheDocument();
  });

  it('una empresa sin empleados en ZEAL lo dice', async () => {
    server.use(http.get(`*${EMPLOYEES_ENDPOINT}`, () => HttpResponse.json([])));
    storeSession('ADMIN');
    renderRoute(ADMIN_PATHS.employees);

    expect(
      await screen.findByText('Aún no hay empleados de tu empresa en ZEAL.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/· 0 personas/)).toBeInTheDocument();
  });

  it('cuenta en singular cuando hay una sola persona', async () => {
    server.use(
      http.get(`*${EMPLOYEES_ENDPOINT}`, () =>
        HttpResponse.json([{ id: 'u1', fullName: 'Ana Ruiz', email: 'ana@nexura.co' }]),
      ),
    );
    storeSession('ADMIN');
    renderRoute(ADMIN_PATHS.employees);

    expect(await screen.findByText(/· 1 persona$/)).toBeInTheDocument();
  });

  it('si no carga, avisa y deja reintentar', async () => {
    server.use(
      http.get(`*${EMPLOYEES_ENDPOINT}`, () => HttpResponse.json({}, { status: 500 }), {
        once: true,
      }),
    );
    storeSession('ADMIN');
    const { user } = renderRoute(ADMIN_PATHS.employees);

    expect(screen.getByText('Cargando a tus empleados…')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos cargar a tus empleados.',
    );
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(
      await screen.findByRole('list', { name: 'Empleados de la empresa' }),
    ).toBeInTheDocument();
  });

  it('una persona empleada no puede ver el directorio', async () => {
    storeSession('EMPLEADO');
    renderRoute(ADMIN_PATHS.employees);

    expect(await screen.findByText('Error 403 · Permiso denegado')).toBeInTheDocument();
  });
});
