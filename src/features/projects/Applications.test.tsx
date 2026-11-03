import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { EMPLOYEE_PATHS, projectPath } from '@/app/paths';
import { readProjectsDb, writeProjectsDb } from '@/mocks/projects/db';
import { publishToUser } from '@/mocks/realtime';
import { server } from '@/mocks/server';
import { freezeTime } from '@/test/clock';
import { storeSession } from '@/test/credentials';
import { scriptedRealtimeClient } from '@/test/realtime';
import { renderRoute } from '@/test/renderRoute';
import { applicationsEndpoint, MY_APPLICATIONS_ENDPOINT } from './api/projectsApi';
import type { Application } from './model/application';
import { APPLICATIONS_QUEUE } from './model/application';

const DAVID = 'usr-empleado-001';
const GUARDIA = 'proyecto-guardia-datos';
const GUARDIA_TITLE = 'Data Platform · Turno de guardia';

function openAsEmployee(path: string = EMPLOYEE_PATHS.projects, scripted = false) {
  storeSession('EMPLEADO');
  const realtime = scriptedRealtimeClient();
  const view = renderRoute(path, scripted ? () => realtime.client : undefined);
  return { ...view, realtime };
}

async function cardOf(title: string) {
  return within(await screen.findByRole('listitem', { name: title }));
}

function toasts() {
  return within(screen.getByRole('region', { name: 'Avisos' }));
}

function myApplications() {
  return within(screen.getByRole('region', { name: 'Mis postulaciones' }));
}

function setProject(id: string, changes: { occupied?: number; closesAt?: string }) {
  const db = readProjectsDb();
  const project = db.projects.find((candidate) => candidate.id === id);
  if (project !== undefined) {
    Object.assign(project, changes);
  }
  writeProjectsDb(db);
}

/** Retiene la postulación hasta que la prueba la suelte; luego sigue al servidor simulado. */
function holdApplications() {
  let release: () => void = () => undefined;
  let requests = 0;
  server.events.on('request:start', ({ request }) => {
    if (request.method === 'POST' && request.url.includes('/postulaciones')) {
      requests += 1;
    }
  });
  server.use(
    http.post(`*${applicationsEndpoint(GUARDIA)}`, async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    }),
  );
  return {
    release: () => {
      release();
    },
    requests: () => requests,
  };
}

const LIVE_APPLICATION: Application = {
  id: 'postulacion-77',
  projectId: 'proyecto-accesibilidad',
  projectTitle: 'Accesibilidad en producto',
  status: 'EN_ESPERA',
  waitlistPosition: 3,
  createdAt: new Date(2026, 8, 23, 9, 10).toISOString(),
  version: 1,
};

describe('Postularse a una convocatoria (HU-FE-17)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('con cupo, queda aceptada: lo informa, ocupa el cupo y aparece en Mis postulaciones', async () => {
    const { user } = openAsEmployee();
    const guardia = await cardOf(GUARDIA_TITLE);
    expect(await myApplications().findByText(/Aún no te has postulado/)).toBeInTheDocument();

    await user.click(guardia.getByRole('button', { name: `Postularme a ${GUARDIA_TITLE}` }));

    const result = await guardia.findByText('Aceptada');
    expect(await toasts().findByText(`¡Tienes un cupo en ${GUARDIA_TITLE}!`)).toBeInTheDocument();
    expect(await guardia.findByText('Queda 1 de 4 cupos')).toBeInTheDocument();
    await waitFor(() => {
      expect(result.closest('p')).toHaveFocus();
    });
    const mine = myApplications().getByRole('listitem');
    expect(within(mine).getByRole('link', { name: GUARDIA_TITLE })).toHaveAttribute(
      'href',
      projectPath(GUARDIA),
    );
    expect(mine).toHaveTextContent('Aceptada');
  });

  it('mientras el servidor procesa, el botón muestra que envía y no manda dos postulaciones', async () => {
    const server = holdApplications();
    const { user } = openAsEmployee();
    const guardia = await cardOf(GUARDIA_TITLE);
    const button = guardia.getByRole('button', { name: `Postularme a ${GUARDIA_TITLE}` });

    await user.click(button);
    await user.click(button);

    expect(button).toHaveAccessibleName(`Enviando tu postulación a ${GUARDIA_TITLE}`);
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveTextContent('Enviando…');
    expect(button).toHaveFocus();
    expect(server.requests()).toBe(1);

    server.release();
    expect(await guardia.findByText('Aceptada')).toBeInTheDocument();
    expect(server.requests()).toBe(1);
  });

  it('si otra persona tomó el último cupo un instante antes, queda en lista de espera', async () => {
    setProject(GUARDIA, { occupied: 3 });
    const { user } = openAsEmployee();
    const guardia = await cardOf(GUARDIA_TITLE);
    expect(guardia.getByText('Queda 1 de 4 cupos')).toBeInTheDocument();

    // Alguien toma el último cupo antes de que llegue la postulación de David.
    setProject(GUARDIA, { occupied: 4 });
    await user.click(guardia.getByRole('button', { name: `Postularme a ${GUARDIA_TITLE}` }));

    expect(await guardia.findByText('Lista de espera · puesto 1')).toBeInTheDocument();
    expect(
      await toasts().findByText(`Quedaste en la lista de espera de ${GUARDIA_TITLE}`),
    ).toBeInTheDocument();
    expect(toasts().getByText(/Ocupas el puesto 1/)).toBeInTheDocument();
  });

  it('si el servidor la rechaza, muestra su mensaje y deja volver a intentarlo', async () => {
    const { user } = openAsEmployee();
    const guardia = await cardOf(GUARDIA_TITLE);
    setProject(GUARDIA, { closesAt: new Date(2026, 8, 23, 9).toISOString() });

    await user.click(guardia.getByRole('button', { name: `Postularme a ${GUARDIA_TITLE}` }));

    expect(await toasts().findByText('Esta convocatoria ya cerró.')).toBeInTheDocument();
    expect(
      guardia.getByRole('button', { name: `Postularme a ${GUARDIA_TITLE}` }),
    ).toBeInTheDocument();
  });

  it('una postulación hecha en otra pestaña aparece al instante', async () => {
    openAsEmployee();
    const accesibilidad = await cardOf('Accesibilidad en producto');
    await myApplications().findByText(/Aún no te has postulado/);

    act(() => {
      publishToUser(DAVID, APPLICATIONS_QUEUE, {
        type: 'POSTULACION',
        application: LIVE_APPLICATION,
      });
      publishToUser(DAVID, APPLICATIONS_QUEUE, { type: 'POSTULACION', application: {} });
    });

    expect(await accesibilidad.findByText('Lista de espera · puesto 3')).toBeInTheDocument();
    expect(myApplications().getByRole('listitem')).toHaveTextContent(
      'Accesibilidad en productoLista de espera · puesto 3',
    );
  });

  it('al recuperar la conexión vuelve a pedir sus postulaciones', async () => {
    const { realtime } = openAsEmployee(EMPLOYEE_PATHS.projects, true);
    await myApplications().findByText(/Aún no te has postulado/);
    server.use(
      http.get(`*${MY_APPLICATIONS_ENDPOINT}`, () => HttpResponse.json([LIVE_APPLICATION])),
    );

    act(() => {
      realtime.store.set('reconnecting');
    });
    act(() => {
      realtime.store.set('connected');
    });

    expect(await myApplications().findByText('Lista de espera · puesto 3')).toBeInTheDocument();
  });
});

describe('Mis postulaciones (HU-FE-17)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('se llega desde el encabezado y muestra que carga', async () => {
    openAsEmployee();

    // Antes de que responda el servidor (que no puede contestar dentro del mismo turno).
    expect(screen.getByRole('link', { name: 'Mis postulaciones' })).toHaveAttribute(
      'href',
      '#mis-postulaciones',
    );
    expect(myApplications().getByText('Cargando tus postulaciones…')).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(await myApplications().findByText(/Aún no te has postulado/)).toBeInTheDocument();
  });

  it('permite reintentar si no cargan', async () => {
    server.use(
      http.get(`*${MY_APPLICATIONS_ENDPOINT}`, () => new HttpResponse(null, { status: 500 }), {
        once: true,
      }),
    );
    const { user } = openAsEmployee();

    const alert = await myApplications().findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos cargar tus postulaciones.');
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(await myApplications().findByText(/Aún no te has postulado/)).toBeInTheDocument();
  });
});

describe('Postularse desde el detalle (HU-FE-17)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('el panel "Tu postulación" envía la postulación y muestra el resultado', async () => {
    const { user } = openAsEmployee(projectPath(GUARDIA));
    const panel = within(await screen.findByRole('region', { name: 'Tu postulación' }));

    await user.click(await panel.findByRole('button', { name: `Postularme a ${GUARDIA_TITLE}` }));

    expect(await panel.findByText('Aceptada')).toBeInTheDocument();
    expect(panel.getByText('Queda 1 de 4 cupos')).toBeInTheDocument();
  });
});
