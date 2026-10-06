import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { EMPLOYEE_PATHS } from '@/app/paths';
import { publishToUser } from '@/mocks/realtime';
import { server } from '@/mocks/server';
import { readWorkshopsDb, updateWorkshopOccupied, writeWorkshopsDb } from '@/mocks/workshops/db';
import { freezeTime } from '@/test/clock';
import { storeSession } from '@/test/credentials';
import { scriptedRealtimeClient } from '@/test/realtime';
import { renderRoute } from '@/test/renderRoute';
import { enrollmentsEndpoint, MY_ENROLLMENTS_ENDPOINT } from './api/workshopsApi';
import type { Enrollment } from './model/enrollment';
import { ENROLLMENTS_QUEUE } from './model/enrollment';

const DAVID = 'usr-empleado-001';
const IMPOSTOR = 'taller-impostor';
const IMPOSTOR_TITLE = 'Síndrome del impostor en tu primer empleo';
const MALESTAR = 'taller-malestar-agil';
const MALESTAR_TITLE = 'Gestión del malestar en equipos ágiles';

function openAsEmployee(path: string = EMPLOYEE_PATHS.workshops, scripted = false) {
  storeSession('EMPLEADO');
  const realtime = scriptedRealtimeClient();
  const view = renderRoute(path, scripted ? () => realtime.client : undefined);
  return { ...view, realtime };
}

async function cardOf(title: string) {
  return within(await screen.findByRole('listitem', { name: title }));
}

function dialog() {
  return within(screen.getByRole('alertdialog'));
}

function toasts() {
  return within(screen.getByRole('region', { name: 'Avisos' }));
}

function enrollButton(title: string) {
  return { name: `Inscribirme a ${title}` };
}

/** Inscripción ya guardada en el servidor simulado, como si David se hubiera inscrito antes. */
function enrolledBefore(workshopId: string) {
  const db = readWorkshopsDb();
  db.sequence += 1;
  db.enrollments.push({
    id: `inscripcion-${String(db.sequence)}`,
    workshopId,
    userId: DAVID,
    createdAt: new Date(2026, 8, 22).toISOString(),
    version: 1,
  });
  writeWorkshopsDb(db);
}

/** Retiene la inscripción hasta que la prueba la suelte; luego sigue al servidor simulado. */
function holdEnrollments() {
  let release: () => void = () => undefined;
  let requests = 0;
  server.events.on('request:start', ({ request }) => {
    if (request.method === 'POST' && request.url.includes('/inscripciones')) {
      requests += 1;
    }
  });
  server.use(
    http.post(`*${enrollmentsEndpoint(IMPOSTOR)}`, async () => {
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

const LIVE_ENROLLMENT: Enrollment = {
  id: 'inscripcion-77',
  workshopId: 'taller-conversaciones-dificiles',
  workshopTitle: 'Conversaciones difíciles con tu líder',
  facilitator: 'Laura Martínez',
  startsAt: new Date(2026, 8, 29, 16).toISOString(),
  endsAt: new Date(2026, 8, 29, 17).toISOString(),
  createdAt: new Date(2026, 8, 23, 9, 10).toISOString(),
  version: 1,
};

describe('Inscribirse a un taller (HU-FE-18)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('pide confirmación; al confirmar toma el cupo, lo informa y lo muestra en la tarjeta', async () => {
    const { user } = openAsEmployee();
    const impostor = await cardOf(IMPOSTOR_TITLE);

    await user.click(impostor.getByRole('button', enrollButton(IMPOSTOR_TITLE)));

    expect(screen.getByRole('alertdialog')).toHaveAccessibleName(
      `¿Inscribirte en ${IMPOSTOR_TITLE}?`,
    );
    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(
      'Mañana · 12:30 · 60 min con Andrés Rojas. El cupo es tuyo en cuanto lo confirmemos.',
    );
    expect(dialog().getByRole('button', { name: 'Cancelar' })).toHaveFocus();

    await user.click(dialog().getByRole('button', { name: 'Sí, inscribirme' }));

    const result = await impostor.findByText('Tienes tu cupo');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await toasts().findByText(`¡Tienes tu cupo en ${IMPOSTOR_TITLE}!`)).toBeInTheDocument();
    expect(
      toasts().getByText('Mañana · 12:30 con Andrés Rojas. Lo encuentras en Mis talleres.'),
    ).toBeInTheDocument();
    expect(await impostor.findByText('30 / 30 cupos')).toBeInTheDocument();
    await waitFor(() => {
      expect(result.closest('p')).toHaveFocus();
    });
  });

  it('el taller destacado también se inscribe desde su bloque', async () => {
    const { user } = openAsEmployee();
    const hero = within(await screen.findByRole('article', { name: MALESTAR_TITLE }));

    await user.click(hero.getByRole('button', enrollButton(MALESTAR_TITLE)));
    await user.click(dialog().getByRole('button', { name: 'Sí, inscribirme' }));

    expect(await hero.findByText('Tienes tu cupo')).toBeInTheDocument();
    expect(await hero.findByText('13 / 30 cupos')).toBeInTheDocument();
  });

  it('cancelar no envía nada y devuelve el foco a quien abrió la confirmación', async () => {
    let requests = 0;
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST') {
        requests += 1;
      }
    });
    const { user } = openAsEmployee();
    const impostor = await cardOf(IMPOSTOR_TITLE);
    const button = impostor.getByRole('button', enrollButton(IMPOSTOR_TITLE));

    await user.click(button);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(requests).toBe(0);
  });

  it('mientras el servidor procesa, muestra que inscribe y no envía dos veces', async () => {
    const pending = holdEnrollments();
    const { user } = openAsEmployee();
    const impostor = await cardOf(IMPOSTOR_TITLE);
    await user.click(impostor.getByRole('button', enrollButton(IMPOSTOR_TITLE)));

    await user.click(dialog().getByRole('button', { name: 'Sí, inscribirme' }));

    const confirm = dialog().getByRole('button', { name: 'Inscribiendo…' });
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAttribute('aria-busy', 'true');
    expect(dialog().getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(pending.requests()).toBe(1);

    pending.release();

    expect(await impostor.findByText('Tienes tu cupo')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(pending.requests()).toBe(1);
  });

  it('si otra persona tomó el último cupo un instante antes, lo dice sin sobreasignar', async () => {
    const { user } = openAsEmployee();
    const impostor = await cardOf(IMPOSTOR_TITLE);
    await user.click(impostor.getByRole('button', enrollButton(IMPOSTOR_TITLE)));

    // Mariana toma el último cupo antes de que llegue la inscripción de David.
    const db = readWorkshopsDb();
    const workshop = db.workshops.find(({ id }) => id === IMPOSTOR);
    if (workshop !== undefined) {
      workshop.occupied = 30;
    }
    writeWorkshopsDb(db);
    await user.click(dialog().getByRole('button', { name: 'Sí, inscribirme' }));

    expect(await dialog().findByRole('alert')).toHaveTextContent('Este taller ya no tiene cupos.');
    expect(impostor.queryByText('Tienes tu cupo')).not.toBeInTheDocument();

    await user.click(dialog().getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('si el taller se llena con la confirmación abierta, lo avisa y ya no deja confirmar', async () => {
    const { user } = openAsEmployee();
    const impostor = await cardOf(IMPOSTOR_TITLE);
    await user.click(impostor.getByRole('button', enrollButton(IMPOSTOR_TITLE)));

    act(() => {
      updateWorkshopOccupied(IMPOSTOR, 30);
    });

    expect(await dialog().findByRole('alert')).toHaveTextContent('Este taller se acaba de llenar.');
    expect(dialog().getByRole('button', { name: 'Sí, inscribirme' })).toBeDisabled();
  });

  it('muestra como inscritos los talleres donde ya tiene cupo', async () => {
    enrolledBefore(MALESTAR);
    openAsEmployee();

    const hero = within(await screen.findByRole('article', { name: MALESTAR_TITLE }));

    expect(await hero.findByText('Tienes tu cupo')).toBeInTheDocument();
    expect(hero.queryByRole('button', enrollButton(MALESTAR_TITLE))).not.toBeInTheDocument();
  });
});

describe('Mis talleres (HU-FE-18)', () => {
  beforeEach(() => {
    freezeTime();
  });

  function myWorkshops() {
    return within(screen.getByRole('region', { name: 'Tus inscripciones' }));
  }

  it('se llega desde el catálogo y, sin inscripciones, invita a elegir un taller', async () => {
    const { user, router } = openAsEmployee();

    await user.click(screen.getByRole('link', { name: 'Mis talleres' }));

    expect(router.state.location.pathname).toBe(EMPLOYEE_PATHS.myWorkshops);
    expect(screen.getByRole('heading', { level: 1, name: 'Mis talleres' })).toBeInTheDocument();
    expect(
      await myWorkshops().findByRole('heading', { name: 'Aún no te has inscrito a ningún taller' }),
    ).toBeInTheDocument();

    await user.click(myWorkshops().getByRole('link', { name: 'Ver talleres' }));
    expect(router.state.location.pathname).toBe(EMPLOYEE_PATHS.workshops);
  });

  it('lista sus talleres del más próximo al más lejano, con cuándo empiezan', async () => {
    enrolledBefore(IMPOSTOR);
    enrolledBefore(MALESTAR);
    openAsEmployee(EMPLOYEE_PATHS.myWorkshops);

    const items = await myWorkshops().findAllByRole('listitem');

    expect(items).toHaveLength(2);
    expect(items[0]).toHaveAccessibleName(MALESTAR_TITLE);
    expect(items[0]).toHaveTextContent('Hoy · 10:05 · 50 min · Gabriela Muñoz');
    expect(items[0]).toHaveTextContent('Empieza en 45 min');
    expect(items[1]).toHaveAccessibleName(IMPOSTOR_TITLE);
    expect(items[1]).toHaveTextContent('Mañana · 12:30 · 60 min · Andrés Rojas');
    expect(items[1]).toHaveTextContent('Tienes tu cupo');
  });

  it('una inscripción hecha en otra pestaña aparece al instante', async () => {
    openAsEmployee(EMPLOYEE_PATHS.myWorkshops);
    await myWorkshops().findByRole('heading', { name: 'Aún no te has inscrito a ningún taller' });

    act(() => {
      publishToUser(DAVID, ENROLLMENTS_QUEUE, {
        type: 'INSCRIPCION',
        enrollment: LIVE_ENROLLMENT,
      });
      publishToUser(DAVID, ENROLLMENTS_QUEUE, { type: 'INSCRIPCION', enrollment: {} });
    });

    expect(
      await myWorkshops().findByRole('listitem', { name: 'Conversaciones difíciles con tu líder' }),
    ).toHaveTextContent('Mar 29 · 16:00 · 60 min · Laura Martínez');
  });

  it('un taller que ya empezó se marca en curso', async () => {
    server.use(
      http.get(`*${MY_ENROLLMENTS_ENDPOINT}`, () =>
        HttpResponse.json([
          {
            ...LIVE_ENROLLMENT,
            startsAt: new Date(2026, 8, 23, 9).toISOString(),
            endsAt: new Date(2026, 8, 23, 10).toISOString(),
          },
        ]),
      ),
    );
    openAsEmployee(EMPLOYEE_PATHS.myWorkshops);

    expect(await myWorkshops().findByText('En curso')).toBeInTheDocument();
  });

  it('mientras carga lo indica y, si falla, permite reintentar', async () => {
    server.use(
      http.get(`*${MY_ENROLLMENTS_ENDPOINT}`, () => HttpResponse.json({}, { status: 500 }), {
        once: true,
      }),
    );
    const { user } = openAsEmployee(EMPLOYEE_PATHS.myWorkshops);

    expect(myWorkshops().getByText('Cargando tus talleres…')).toBeInTheDocument();
    const alert = await myWorkshops().findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos cargar tus talleres.');

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(
      await myWorkshops().findByRole('heading', { name: 'Aún no te has inscrito a ningún taller' }),
    ).toBeInTheDocument();
  });

  it('al recuperar la conexión vuelve a pedir sus inscripciones', async () => {
    const { realtime } = openAsEmployee(EMPLOYEE_PATHS.myWorkshops, true);
    await myWorkshops().findByRole('heading', { name: 'Aún no te has inscrito a ningún taller' });
    server.use(http.get(`*${MY_ENROLLMENTS_ENDPOINT}`, () => HttpResponse.json([LIVE_ENROLLMENT])));

    act(() => {
      realtime.store.set('reconnecting');
    });
    act(() => {
      realtime.store.set('connected');
    });

    expect(
      await myWorkshops().findByRole('listitem', { name: 'Conversaciones difíciles con tu líder' }),
    ).toBeInTheDocument();
  });
});
