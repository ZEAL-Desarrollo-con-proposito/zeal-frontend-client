import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RESERVATIONS_ENDPOINT } from '@/features/agenda/api/agendaApi';
import { EMPLOYEE_PATHS, PSYCHOLOGIST_PATHS, ROLE_HOME_PATH } from '@/app/paths';
import { createMockToken } from '@/mocks/mockToken';
import { publishToUser } from '@/mocks/realtime';
import { SEED_USERS } from '@/mocks/seedUsers';
import { server } from '@/mocks/server';
import { FREED_SLOTS_DB_KEY } from '@/mocks/wellbeing/freedSlotsDb';
import { readWellbeingDb } from '@/mocks/wellbeing/db';
import { MUTATION_ERROR_MESSAGES } from '@/shared/api/describeError';
import { controlClock, freezeTime } from '@/test/clock';
import { storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import { arrangeFreedSlotCompetition, MARIANA } from '@/test/wellbeing';
import { claimEndpoint } from './api/freedSlotsApi';
import type { FreedSlotOffer } from './model/freedSlot';
import { FREED_SLOTS_QUEUE } from './model/freedSlotEvent';

const DAVID = 'usr-empleado-001';
const OFFER_ID = 'cupo-1';

/** Cupo de hoy a las 10:00; la ventana para tomarlo vence a las 9:25 (son las 9:20). */
function offer(id = OFFER_ID, overrides: Partial<FreedSlotOffer> = {}): FreedSlotOffer {
  return {
    id,
    psychologist: {
      id: 'usr-psicologo-001',
      fullName: 'Laura Martínez',
      title: 'Psicóloga clínica',
    },
    startsAt: new Date(2026, 8, 23, 10).toISOString(),
    endsAt: new Date(2026, 8, 23, 10, 50).toISOString(),
    expiresAt: new Date(2026, 8, 23, 9, 25).toISOString(),
    ...overrides,
  };
}

const WON_APPOINTMENT = {
  id: 'reserva-90',
  psychologist: { id: 'usr-psicologo-001', fullName: 'Laura Martínez', title: 'Psicóloga clínica' },
  startsAt: new Date(2026, 8, 23, 10).toISOString(),
  endsAt: new Date(2026, 8, 23, 10, 50).toISOString(),
  status: 'CONFIRMADA',
};

function openHome() {
  storeSession('EMPLEADO');
  return renderRoute(ROLE_HOME_PATH.EMPLEADO);
}

function alerts() {
  return within(screen.getByRole('region', { name: 'Cupos liberados' }));
}

async function openHomeReady() {
  const rendered = openHome();
  await screen.findByRole('button', { name: /Notificaciones/ });
  return rendered;
}

function release(...offers: FreedSlotOffer[]) {
  act(() => {
    for (const item of offers) {
      publishToUser(DAVID, FREED_SLOTS_QUEUE, { type: 'LIBERADO', offer: item });
    }
  });
}

function takenByOther(offerId = OFFER_ID) {
  act(() => {
    publishToUser(DAVID, FREED_SLOTS_QUEUE, { type: 'TOMADO', offerId });
  });
}

/** El servidor responde a "tomar el cupo" cuando la prueba lo decide; cuenta cada petición. */
function heldClaim(respond: () => Response) {
  let open: () => void = () => undefined;
  const requests: string[] = [];
  server.use(
    http.post(`*${claimEndpoint(OFFER_ID)}`, async ({ request }) => {
      requests.push(request.method);
      await new Promise<void>((resolve) => {
        open = resolve;
      });
      return respond();
    }),
  );
  return {
    requests,
    answer: () => {
      open();
    },
  };
}

function serverAnswers(response: () => Response) {
  server.use(http.post(`*${claimEndpoint(OFFER_ID)}`, response));
}

const conflict = () =>
  HttpResponse.json(
    { status: 409, error: 'Conflict', message: 'Otra persona tomó este cupo antes que tú.' },
    { status: 409 },
  );

async function claimIt(user: ReturnType<typeof renderRoute>['user']) {
  await user.click(await alerts().findByRole('button', { name: 'Tomar el cupo' }));
}

describe('Cupo liberado · la alerta (HU-FE-08)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('llega sin recargar con quién, cuándo y cuánto tiempo hay para tomarlo', async () => {
    await openHomeReady();
    expect(alerts().queryByRole('listitem')).not.toBeInTheDocument();

    release(offer());

    expect(await alerts().findByText('Se liberó un cupo')).toBeInTheDocument();
    expect(alerts().getByText('Laura Martínez · Hoy · 10:00 – 10:50')).toBeInTheDocument();
    expect(alerts().getByText('5:00')).toBeInTheDocument();
    expect(alerts().getByText('Tómalo antes de las 9:25')).toBeInTheDocument();
    expect(alerts().getByRole('button', { name: 'Tomar el cupo' })).toBeEnabled();
  });

  it('acompaña a la persona por las pantallas sin perderse al navegar', async () => {
    const { user, router } = await openHomeReady();
    release(offer());
    expect(await alerts().findByText('Se liberó un cupo')).toBeInTheDocument();

    await user.click(
      within(screen.getByRole('complementary', { name: 'Barra lateral' })).getByRole('link', {
        name: 'Mis citas',
      }),
    );

    expect(router.state.location.pathname).toBe(EMPLOYEE_PATHS.appointments);
    expect(alerts().getByText('Se liberó un cupo')).toBeInTheDocument();
  });

  it('solo la recibe quien tiene una cita posterior: la de otra persona no llega', async () => {
    await openHomeReady();

    act(() => {
      publishToUser(MARIANA, FREED_SLOTS_QUEUE, { type: 'LIBERADO', offer: offer('para-mariana') });
    });
    release(offer('para-david'));

    expect(await alerts().findAllByRole('listitem')).toHaveLength(1);
    expect(alerts().getByRole('button', { name: 'Tomar el cupo' })).toBeInTheDocument();
  });

  it('no aparece para la psicóloga', async () => {
    storeSession('PSICOLOGO');
    renderRoute(PSYCHOLOGIST_PATHS.agenda);
    await screen.findByRole('button', { name: /Notificaciones/ });

    expect(screen.queryByRole('region', { name: 'Cupos liberados' })).not.toBeInTheDocument();
  });

  it('ignora mensajes mal formados y cupos que ya vencieron al llegar', async () => {
    await openHomeReady();

    act(() => {
      publishToUser(DAVID, FREED_SLOTS_QUEUE, { type: 'BORRADO' });
      publishToUser(DAVID, FREED_SLOTS_QUEUE, { type: 'LIBERADO', offer: { id: 'roto' } });
    });
    release(offer('vencido', { expiresAt: new Date(2026, 8, 23, 9, 19).toISOString() }));
    release(offer('vigente'));

    expect(await alerts().findAllByRole('listitem')).toHaveLength(1);
  });

  it('si el mismo cupo llega dos veces, o después de cerrarlo, se muestra una sola vez', async () => {
    const { user } = await openHomeReady();

    release(offer(), offer());
    await alerts().findAllByRole('listitem');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(alerts().getAllByRole('listitem')).toHaveLength(1);

    await user.click(alerts().getByRole('button', { name: 'Cerrar aviso de cupo' }));
    await waitFor(() => {
      expect(alerts().queryByRole('listitem')).not.toBeInTheDocument();
    });
    release(offer());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(alerts().queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('muestra como máximo 3 alertas: la más antigua sale', async () => {
    await openHomeReady();
    const by = (id: string, fullName: string) =>
      offer(id, { psychologist: { id: `psi-${id}`, fullName, title: 'Psicólogo' } });

    release(
      by('a', 'Ana Uno'),
      by('b', 'Beto Dos'),
      by('c', 'Carla Tres'),
      by('d', 'Diego Cuatro'),
    );

    expect(await alerts().findByText(/Diego Cuatro/)).toBeInTheDocument();
    expect(alerts().getAllByRole('listitem')).toHaveLength(3);
    expect(alerts().queryByText(/Ana Uno/)).not.toBeInTheDocument();
    expect(alerts().getByText(/Beto Dos/)).toBeInTheDocument();
  });
});

describe('Cupo liberado · el temporizador (HU-FE-08)', () => {
  beforeEach(() => {
    controlClock();
  });

  it('cuenta hacia atrás y, al llegar a cero, ya no se puede tomar', async () => {
    await openHomeReady();
    release(offer());
    expect(await alerts().findByText('5:00')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(alerts().getByText('4:00')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4 * 60_000);
    });
    expect(alerts().getByText('Se acabó el tiempo para este cupo')).toBeInTheDocument();
    expect(alerts().queryByRole('button', { name: 'Tomar el cupo' })).not.toBeInTheDocument();
    expect(alerts().getByRole('button', { name: 'Cerrar aviso de cupo' })).toBeInTheDocument();
  });
});

describe('Cupo liberado · tomar el cupo (HU-FE-08)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('el botón se bloquea tras el primer clic y solo viaja una petición', async () => {
    const claim = heldClaim(() => HttpResponse.json(WON_APPOINTMENT));
    const { user } = await openHomeReady();
    release(offer());

    await claimIt(user);

    const busy = await alerts().findByRole('button', { name: 'Tomando el cupo…' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    // Insistir no hace nada: ni se envía de nuevo ni se puede cerrar la alerta a mitad de camino.
    await user.dblClick(busy);
    expect(
      alerts().queryByRole('button', { name: 'Cerrar aviso de cupo' }),
    ).not.toBeInTheDocument();
    claim.answer();
    expect(await alerts().findByText('¡El cupo es tuyo!')).toBeInTheDocument();
    expect(claim.requests).toEqual(['POST']);
  });

  it('si ganó, lo dice con claridad y lleva a Mis citas', async () => {
    serverAnswers(() => HttpResponse.json(WON_APPOINTMENT));
    const { user, router } = await openHomeReady();
    release(offer());

    await claimIt(user);

    expect(await alerts().findByText('¡El cupo es tuyo!')).toBeInTheDocument();
    expect(alerts().getByText('Laura Martínez · Hoy · 10:00 – 10:50')).toBeInTheDocument();
    expect(alerts().queryByRole('button', { name: 'Tomar el cupo' })).not.toBeInTheDocument();
    expect(alerts().queryByText('5:00')).not.toBeInTheDocument();

    await user.click(alerts().getByRole('link', { name: 'Ver mis citas' }));

    expect(router.state.location.pathname).toBe(EMPLOYEE_PATHS.appointments);
    await waitFor(() => {
      expect(alerts().queryByRole('listitem')).not.toBeInTheDocument();
    });
  });

  it('si otra persona lo tomó primero, lo dice con claridad y explica por qué', async () => {
    serverAnswers(conflict);
    const { user } = await openHomeReady();
    release(offer());

    await claimIt(user);

    expect(await alerts().findByText('Otra persona lo tomó primero')).toBeInTheDocument();
    expect(alerts().getByText('Otra persona tomó este cupo antes que tú.')).toBeInTheDocument();
    expect(
      alerts().queryByRole('button', { name: /Tomar el cupo|Tomando/ }),
    ).not.toBeInTheDocument();
    expect(alerts().queryByRole('link', { name: 'Ver mis citas' })).not.toBeInTheDocument();
  });

  it('si otra persona lo toma mientras se mira, la alerta cambia sola', async () => {
    await openHomeReady();
    release(offer());
    expect(await alerts().findByRole('button', { name: 'Tomar el cupo' })).toBeInTheDocument();

    takenByOther();

    expect(await alerts().findByText('Otra persona lo tomó primero')).toBeInTheDocument();
    expect(alerts().queryByRole('button', { name: 'Tomar el cupo' })).not.toBeInTheDocument();
  });

  it('un aviso de "tomado" mientras se toma no adelanta el resultado: lo decide el servidor', async () => {
    const claim = heldClaim(() => HttpResponse.json(WON_APPOINTMENT));
    const { user } = await openHomeReady();
    release(offer());
    await claimIt(user);
    await alerts().findByRole('button', { name: 'Tomando el cupo…' });

    takenByOther();
    expect(alerts().getByRole('button', { name: 'Tomando el cupo…' })).toBeDisabled();
    claim.answer();

    expect(await alerts().findByText('¡El cupo es tuyo!')).toBeInTheDocument();
    takenByOther();
    expect(alerts().getByText('¡El cupo es tuyo!')).toBeInTheDocument();
  });

  it.each([
    [
      '404',
      () => HttpResponse.json({ message: 'Este cupo ya no está disponible.' }, { status: 404 }),
    ],
    [
      '410',
      () => HttpResponse.json({ message: 'El tiempo para tomarlo venció.' }, { status: 410 }),
    ],
  ])('si el servidor dice %s, explica que ya no está disponible', async (_status, respond) => {
    serverAnswers(respond);
    const { user } = await openHomeReady();
    release(offer());

    await claimIt(user);

    expect(await alerts().findByText('Este cupo ya no está disponible')).toBeInTheDocument();
    expect(alerts().queryByRole('button', { name: 'Tomar el cupo' })).not.toBeInTheDocument();
    expect(alerts().getByText(/ya no está disponible\.|venció\./)).toBeInTheDocument();
  });

  it('si el servidor rechaza sin explicación, no inventa una', async () => {
    serverAnswers(() => new HttpResponse(null, { status: 404 }));
    const { user } = await openHomeReady();
    release(offer());

    await claimIt(user);

    expect(await alerts().findByText('Este cupo ya no está disponible')).toBeInTheDocument();
    expect(alerts().queryByText('Este cupo ya no está disponible.')).not.toBeInTheDocument();
    expect(alerts().queryByText(MUTATION_ERROR_MESSAGES.generic)).not.toBeInTheDocument();
  });

  it.each([
    ['sin conexión', () => HttpResponse.error(), MUTATION_ERROR_MESSAGES.network],
    [
      'con un error del servidor',
      () => new HttpResponse(null, { status: 500 }),
      MUTATION_ERROR_MESSAGES.generic,
    ],
  ])('%s, avisa y deja intentarlo de nuevo', async (_case, fail, message) => {
    serverAnswers(fail);
    const { user } = await openHomeReady();
    release(offer());
    await claimIt(user);

    expect(await alerts().findByRole('alert')).toHaveTextContent(message);
    expect(alerts().getByRole('button', { name: 'Tomar el cupo' })).toBeEnabled();

    serverAnswers(() => HttpResponse.json(WON_APPOINTMENT));
    await claimIt(user);

    expect(await alerts().findByText('¡El cupo es tuyo!')).toBeInTheDocument();
  });

  it('cierra la alerta de un cupo resuelto sin afectar a las demás', async () => {
    serverAnswers(conflict);
    const { user } = await openHomeReady();
    release(offer(), offer('otro'));
    const first = (await alerts().findAllByRole('listitem'))[0];
    if (first === undefined) {
      throw new Error('No apareció la alerta');
    }
    await user.click(within(first).getByRole('button', { name: 'Tomar el cupo' }));
    await user.click(await within(first).findByRole('button', { name: 'Cerrar aviso de cupo' }));

    await waitFor(() => {
      expect(alerts().getAllByRole('listitem')).toHaveLength(1);
    });
    expect(alerts().getByRole('button', { name: 'Tomar el cupo' })).toBeInTheDocument();
  });
});

describe('Cupo liberado · de punta a punta con el servidor simulado (HU-FE-08)', () => {
  beforeEach(() => {
    freezeTime();
  });

  function cancelAsMariana(reservationId: string) {
    const mariana = SEED_USERS.find(({ id }) => id === MARIANA);
    if (mariana === undefined) {
      throw new Error('Mariana no es un usuario semilla');
    }
    return fetch(
      new URL(`${RESERVATIONS_ENDPOINT}/${reservationId}/cancelar`, window.location.origin),
      { method: 'POST', headers: { Authorization: `Bearer ${createMockToken(mariana)}` } },
    );
  }

  async function marianaCancels() {
    const reservation = arrangeFreedSlotCompetition();
    const rendered = await openHomeReady();
    const response = await act(() => cancelAsMariana(reservation.id));
    expect(response.status).toBe(200);
    expect(await alerts().findByText('Se liberó un cupo')).toBeInTheDocument();
    expect(alerts().getByText('Laura Martínez · Vie 25 · 8:00 – 8:50')).toBeInTheDocument();
    return rendered;
  }

  it('al cancelar una cita, quien tiene una posterior ese día recibe la alerta y gana el cupo', async () => {
    const { user } = await marianaCancels();

    await claimIt(user);

    expect(await alerts().findByText('¡El cupo es tuyo!')).toBeInTheDocument();
    const mine = readWellbeingDb().reservations.filter(
      ({ employee, startsAt }) =>
        employee.id === DAVID && startsAt === new Date(2026, 8, 25, 8).toISOString(),
    );
    expect(mine).toHaveLength(1);
    expect(mine[0]?.status).toBe('CONFIRMADA');
  });

  it('si otra persona se adelantó, el servidor lo rechaza y la alerta lo explica', async () => {
    const { user } = await marianaCancels();
    // Otra persona lo tomó un instante antes; su evento aún no llega a esta pestaña.
    const stored = JSON.parse(localStorage.getItem(FREED_SLOTS_DB_KEY) ?? 'null') as {
      offers: { status: string; takenBy: string | null }[];
    };
    for (const record of stored.offers) {
      record.status = 'TOMADO';
      record.takenBy = 'usr-empleado-004';
    }
    localStorage.setItem(FREED_SLOTS_DB_KEY, JSON.stringify(stored));

    await claimIt(user);

    expect(await alerts().findByText('Otra persona lo tomó primero')).toBeInTheDocument();
    expect(alerts().getByText('Otra persona tomó este cupo antes que tú.')).toBeInTheDocument();
  });
});
