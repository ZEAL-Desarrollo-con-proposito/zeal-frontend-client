import { screen, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ADMIN_PATHS } from '@/app/paths';
import { server } from '@/mocks/server';
import { ADMIN_PROJECTS_ENDPOINT } from '@/features/projects/api/adminProjectsApi';
import { ADMIN_WORKSHOPS_ENDPOINT } from '@/features/workshops/api/adminWorkshopsApi';
import { freezeTime } from '@/test/clock';
import { storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import { EMPLOYEES_ENDPOINT } from './api/employeesApi';

const DAY = 86_400_000;

function project(id: string, capacity: number, occupied: number, closesInDays: number) {
  return {
    id,
    title: `Convocatoria ${id}`,
    area: 'Datos',
    cohort: 'Q4',
    summary: 'Resumen',
    capacity,
    occupied,
    version: occupied,
    closesAt: new Date(Date.now() + closesInDays * DAY).toISOString(),
    publishedAt: new Date(Date.now() - 3 * DAY).toISOString(),
  };
}

function workshop(id: string, capacity: number, occupied: number, startsInDays: number) {
  return {
    id,
    title: `Taller ${id}`,
    description: 'Descripción',
    capacity,
    occupied,
    version: occupied,
    startsAt: new Date(Date.now() + startsInDays * DAY).toISOString(),
    durationMinutes: 60,
    publishedAt: new Date(Date.now() - 3 * DAY).toISOString(),
  };
}

/** Datos de la empresa controlados por la prueba: 3 personas, 4 convocatorias y 3 talleres. */
function useCompanyData() {
  server.use(
    http.get(`*${EMPLOYEES_ENDPOINT}`, () =>
      HttpResponse.json([
        { id: 'e1', fullName: 'Ana Gómez', email: 'ana@nexura.co' },
        { id: 'e2', fullName: 'Beto Ruiz', email: 'beto@nexura.co' },
        { id: 'e3', fullName: 'Carla Pérez', email: 'carla@nexura.co' },
      ]),
    ),
    http.get(`*${ADMIN_PROJECTS_ENDPOINT}`, () =>
      HttpResponse.json([
        project('a', 10, 3, 5),
        project('b', 4, 4, 2),
        project('c', 6, 6, -1),
        project('d', 8, 1, -9),
      ]),
    ),
    http.get(`*${ADMIN_WORKSHOPS_ENDPOINT}`, () =>
      HttpResponse.json([
        workshop('a', 10, 5, 3),
        workshop('b', 10, 10, -2),
        workshop('c', 20, 5, 20),
      ]),
    ),
  );
}

function stat(region: HTMLElement, name: string) {
  const term = within(region).getByText(name, { selector: 'dt' });
  return term.parentElement?.querySelector('dd')?.textContent;
}

describe('Reportes de la empresa', () => {
  it('muestra totales agregados de personas, convocatorias y talleres, nunca individuales', async () => {
    freezeTime();
    storeSession('ADMIN');
    useCompanyData();
    const { user } = await renderRoute(ADMIN_PATHS.workshops);

    await user.click(screen.getByRole('link', { name: 'Reportes' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Reportes' })).toBeInTheDocument();
    expect(screen.getByText('Datos agregados de Nexura S.A.S.')).toBeInTheDocument();
    expect(screen.getByText(/Nunca datos individuales/)).toBeInTheDocument();

    const people = await screen.findByRole('region', { name: 'Personas' });
    expect(stat(people, 'Con cuenta en ZEAL')).toBe('3');

    const projects = screen.getByRole('region', { name: 'Convocatorias' });
    expect(stat(projects, 'Publicadas')).toBe('4');
    expect(stat(projects, 'Abiertas')).toBe('2');
    expect(stat(projects, 'Cerradas')).toBe('2');
    expect(stat(projects, 'Abiertas sin cupos')).toBe('1');
    expect(within(projects).getByText('14 de 28 cupos ocupados (50 %)')).toBeInTheDocument();
    expect(
      within(projects).getByRole('progressbar', { name: 'Cupos de convocatorias ocupados' }),
    ).toHaveAttribute('value', '50');

    const workshops = screen.getByRole('region', { name: 'Talleres' });
    expect(stat(workshops, 'Programados')).toBe('3');
    expect(stat(workshops, 'Próximos')).toBe('2');
    expect(stat(workshops, 'Ya realizados')).toBe('1');
    expect(within(workshops).getByText('20 de 40 cupos ocupados (50 %)')).toBeInTheDocument();
  });

  it('avisa mientras carga y permite reintentar si falla', async () => {
    storeSession('ADMIN');
    let failing = true;
    server.use(
      http.get(`*${ADMIN_PROJECTS_ENDPOINT}`, async () => {
        await delay(30);
        return failing ? new HttpResponse(null, { status: 500 }) : HttpResponse.json([]);
      }),
    );
    const { user } = await renderRoute(ADMIN_PATHS.reports);

    expect(await screen.findByText('Cargando los reportes…')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar los reportes.');

    failing = false;
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('region', { name: 'Convocatorias' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Organización de la empresa', () => {
  it('muestra la empresa, quién la administra y lo que tiene en ZEAL', async () => {
    freezeTime();
    storeSession('ADMIN');
    useCompanyData();
    const { user } = await renderRoute(ADMIN_PATHS.workshops);

    await user.click(screen.getByRole('link', { name: 'Organización' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Organización' }),
    ).toBeInTheDocument();
    const company = screen.getByRole('region', { name: 'Tu empresa' });
    expect(within(company).getByText('Nexura S.A.S.')).toBeInTheDocument();
    expect(within(company).getByText('Administra')).toBeInTheDocument();

    const activity = await screen.findByRole('region', { name: 'Lo que tienes en ZEAL' });
    expect(await within(activity).findByText('Personas con cuenta')).toBeInTheDocument();
    expect(stat(activity, 'Personas con cuenta')).toBe('3');
    expect(stat(activity, 'Convocatorias publicadas')).toBe('4');
    expect(stat(activity, 'Talleres programados')).toBe('3');
    expect(screen.getByText('Los datos de Nexura S.A.S. · 3 personas en ZEAL')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Cómo se protege a las personas de tu empresa' }),
    ).toHaveTextContent('Cada empresa solo accede a sus propios datos.');

    await user.click(within(activity).getByRole('link', { name: 'Ver reportes' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Reportes' })).toBeInTheDocument();
  });

  it('avisa mientras carga y permite reintentar si falla', async () => {
    storeSession('ADMIN');
    let failing = true;
    server.use(
      http.get(`*${ADMIN_WORKSHOPS_ENDPOINT}`, async () => {
        await delay(30);
        return failing ? new HttpResponse(null, { status: 500 }) : HttpResponse.json([]);
      }),
    );
    const { user } = await renderRoute(ADMIN_PATHS.organization);

    expect(await screen.findByText('Cargando los datos de tu empresa…')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos cargar los datos de tu empresa.',
    );

    failing = false;
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Convocatorias publicadas')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
