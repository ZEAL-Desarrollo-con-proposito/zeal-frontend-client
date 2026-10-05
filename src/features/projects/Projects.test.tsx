import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { EMPLOYEE_PATHS, projectPath, ROLE_HOME_PATH } from '@/app/paths';
import { readProjectsDb, updateOccupiedSpots, writeProjectsDb } from '@/mocks/projects/db';
import { server } from '@/mocks/server';
import { freezeTime } from '@/test/clock';
import { storeSession } from '@/test/credentials';
import { scriptedRealtimeClient } from '@/test/realtime';
import { renderRoute } from '@/test/renderRoute';
import { PROJECTS_ENDPOINT } from './api/projectsApi';
import { projectTopic } from './model/spotsEvent';

const GUARDIA = 'proyecto-guardia-datos';

function openAsEmployee(path: string = EMPLOYEE_PATHS.projects, scripted = false) {
  storeSession('EMPLEADO');
  const realtime = scriptedRealtimeClient();
  const view = renderRoute(path, scripted ? () => realtime.client : undefined);
  return { ...view, realtime };
}

async function cardOf(title: string) {
  return within(await screen.findByRole('listitem', { name: title }));
}

function spotsEvent(occupied: number, version: number, projectId = GUARDIA) {
  return { type: 'CUPOS', projectId, capacity: 4, occupied, version };
}

describe('Catálogo de convocatorias (HU-FE-16)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('se llega desde el menú y muestra cada convocatoria con sus cupos y su cierre', async () => {
    storeSession('EMPLEADO');
    const { user, router } = renderRoute(ROLE_HOME_PATH.EMPLEADO);

    await user.click(
      within(screen.getByRole('complementary', { name: 'Barra lateral' })).getByRole('link', {
        name: 'Proyectos',
      }),
    );

    expect(router.state.location.pathname).toBe(EMPLOYEE_PATHS.projects);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Convocatorias internas' }),
    ).toBeInTheDocument();
    const guardia = await cardOf('Data Platform · Turno de guardia');
    expect(guardia.getByText('Datos · Rotación trimestral')).toBeInTheDocument();
    expect(guardia.getByText('Quedan 2 de 4 cupos')).toBeInTheDocument();
    expect(guardia.getByText('Cierra en 5 días')).toBeInTheDocument();
    expect(
      guardia.getByRole('button', { name: 'Postularme a Data Platform · Turno de guardia' }),
    ).toBeEnabled();
    expect(screen.getAllByRole('listitem', { name: /./ })).toHaveLength(4);
  });

  it('una convocatoria sin cupos no deja postularse', async () => {
    openAsEmployee();

    const full = await cardOf('Squad de Observabilidad');

    expect(full.getByText('Sin cupos · 3 de 3 ocupados')).toBeInTheDocument();
    expect(full.getByRole('button', { name: 'Cupos agotados' })).toBeDisabled();
    expect(full.queryByRole('button', { name: /Postularme/ })).not.toBeInTheDocument();
    expect(
      full.getByRole('link', { name: 'Ver detalle de Squad de Observabilidad' }),
    ).toHaveAttribute('href', projectPath('proyecto-observabilidad'));
  });

  it('el contador cambia en vivo y, al llegar a cero, la postulación se deshabilita', async () => {
    openAsEmployee();
    const guardia = await cardOf('Data Platform · Turno de guardia');

    act(() => {
      updateOccupiedSpots(GUARDIA, 3);
    });
    expect(await guardia.findByText('Queda 1 de 4 cupos')).toBeInTheDocument();

    act(() => {
      updateOccupiedSpots(GUARDIA, 4);
    });
    expect(await guardia.findByRole('button', { name: 'Cupos agotados' })).toBeDisabled();
    expect(guardia.getByText('Sin cupos · 4 de 4 ocupados')).toBeInTheDocument();

    // Si se libera un cupo, vuelve a ofrecerse.
    act(() => {
      updateOccupiedSpots(GUARDIA, 3);
    });
    expect(
      await guardia.findByRole('button', { name: 'Postularme a Data Platform · Turno de guardia' }),
    ).toBeInTheDocument();
  });

  it('descarta los avisos atrasados y los de otra convocatoria', async () => {
    const { realtime } = openAsEmployee(EMPLOYEE_PATHS.projects, true);
    const guardia = await cardOf('Data Platform · Turno de guardia');

    act(() => {
      realtime.deliver(projectTopic(GUARDIA), spotsEvent(4, 3));
      realtime.deliver(projectTopic(GUARDIA), spotsEvent(1, 2));
      realtime.deliver(projectTopic(GUARDIA), spotsEvent(0, 9, 'otra'));
      realtime.deliver(projectTopic(GUARDIA), { type: 'CUPOS' });
    });

    expect(await guardia.findByText('Sin cupos · 4 de 4 ocupados')).toBeInTheDocument();
  });

  it('al recuperar la conexión vuelve a pedir el catálogo para no perder cambios', async () => {
    const { realtime } = openAsEmployee(EMPLOYEE_PATHS.projects, true);
    const guardia = await cardOf('Data Platform · Turno de guardia');

    act(() => {
      realtime.store.set('reconnecting');
    });
    // Sin conexión, el aviso del servidor se pierde.
    updateOccupiedSpots(GUARDIA, 4);
    act(() => {
      realtime.store.set('connected');
    });

    expect(await guardia.findByRole('button', { name: 'Cupos agotados' })).toBeDisabled();
  });

  it('muestra que carga, y explica cuando no hay convocatorias abiertas', async () => {
    server.use(http.get(`*${PROJECTS_ENDPOINT}`, () => HttpResponse.json([])));
    openAsEmployee();

    expect(screen.getByRole('region', { name: 'Convocatorias abiertas' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(
      await screen.findByRole('heading', { name: 'No hay convocatorias abiertas' }),
    ).toBeInTheDocument();
  });

  it('permite reintentar si el catálogo no carga', async () => {
    server.use(
      http.get(`*${PROJECTS_ENDPOINT}`, () => new HttpResponse(null, { status: 500 }), {
        once: true,
      }),
    );
    const { user } = openAsEmployee();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos cargar las convocatorias.');
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(await cardOf('Mentoría inversa Gen Z')).toBeTruthy();
  });
});

describe('Detalle de una convocatoria (HU-FE-16)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('muestra de qué se trata, qué se necesita y qué suma al ZEAL Path', async () => {
    const { user, router } = openAsEmployee();
    const guardia = await cardOf('Data Platform · Turno de guardia');

    await user.click(
      guardia.getByRole('link', { name: 'Ver detalle de Data Platform · Turno de guardia' }),
    );

    expect(router.state.location.pathname).toBe(projectPath(GUARDIA));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Data Platform · Turno de guardia' }),
    ).toBeInTheDocument();
    expect(document.title).toBe('Detalle de la convocatoria · ZEAL');
    expect(screen.getByRole('region', { name: 'De qué se trata' })).toHaveTextContent(
      'Rotarás en el turno de guardia',
    );
    expect(screen.getByText('Conocer SQL')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Qué suma a tu ZEAL Path' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(2);
    expect(
      within(screen.getByRole('region', { name: 'Tu postulación' })).getByText(
        'Quedan 2 de 4 cupos',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Convocatorias internas' }));
    expect(router.state.location.pathname).toBe(EMPLOYEE_PATHS.projects);
  });

  it('sus cupos también cambian en vivo hasta agotarse', async () => {
    openAsEmployee(projectPath(GUARDIA));
    const spots = within(await screen.findByRole('region', { name: 'Tu postulación' }));

    act(() => {
      updateOccupiedSpots(GUARDIA, 4);
    });

    expect(await spots.findByRole('button', { name: 'Cupos agotados' })).toBeDisabled();
    expect(spots.getByText('Sin cupos · 4 de 4 ocupados')).toBeInTheDocument();
  });

  it('una convocatoria vencida ya no recibe postulaciones', async () => {
    const db = readProjectsDb();
    const guardia = db.projects.find(({ id }) => id === GUARDIA);
    if (guardia !== undefined) {
      guardia.closesAt = new Date(2026, 8, 23, 8).toISOString();
    }
    writeProjectsDb(db);
    openAsEmployee(projectPath(GUARDIA));

    const spots = within(await screen.findByRole('region', { name: 'Tu postulación' }));

    expect(spots.getByRole('button', { name: 'Convocatoria cerrada' })).toBeDisabled();
    expect(screen.getByText('Cerrada')).toBeInTheDocument();
  });

  it('avisa si la convocatoria no existe y ofrece volver al catálogo', async () => {
    const { user, router } = openAsEmployee(projectPath('no-existe'));

    expect(
      await screen.findByRole('heading', { name: 'No encontramos esta convocatoria' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Ver convocatorias' }));

    expect(router.state.location.pathname).toBe(EMPLOYEE_PATHS.projects);
  });

  it('muestra que carga y permite reintentar si el detalle falla', async () => {
    server.use(
      http.get(`*${PROJECTS_ENDPOINT}/:id`, () => new HttpResponse(null, { status: 500 }), {
        once: true,
      }),
    );
    const { user } = openAsEmployee(projectPath(GUARDIA));

    expect(
      screen.getByText('Convocatoria', { selector: '[aria-current="page"]' }),
    ).toBeInTheDocument();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos cargar la convocatoria.');
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Data Platform · Turno de guardia' }),
    ).toBeInTheDocument();
  });

  it('el administrador no ve las convocatorias del empleado', async () => {
    storeSession('ADMIN');
    renderRoute(projectPath(GUARDIA));

    expect(
      await screen.findByRole('heading', { name: 'Esta sección no está disponible para tu rol' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Data Platform · Turno de guardia')).not.toBeInTheDocument();
    });
  });
});
