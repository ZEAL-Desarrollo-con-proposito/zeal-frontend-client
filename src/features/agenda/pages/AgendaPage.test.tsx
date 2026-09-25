import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PSYCHOLOGIST_PATHS } from '@/app/paths';
import { SLOTS_TOPIC } from '@/features/availability/model/slotEvent';
import { publishMockEvent } from '@/mocks/realtime';
import { server } from '@/mocks/server';
import { readWellbeingDb, writeWellbeingDb } from '@/mocks/wellbeing/db';
import type { RealtimeClient } from '@/shared/realtime/realtimeClient';
import { createStatusStore } from '@/shared/realtime/realtimeClient';
import { freezeTime } from '@/test/clock';
import { storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import { AGENDA_ENDPOINT } from '../api/agendaApi';

const TODAY = 'Hoy · Miércoles, 23 de septiembre';

function openAgenda(search = '', realtimeFactory?: () => RealtimeClient) {
  storeSession('PSICOLOGO');
  return renderRoute(`${PSYCHOLOGIST_PATHS.agenda}${search}`, realtimeFactory);
}

function day(name: string) {
  return within(screen.getByRole('region', { name }));
}

/** Filas de un día, una vez que la agenda terminó de cargar. */
async function rowsOf(name: string) {
  return within(await screen.findByRole('region', { name })).getAllByRole('listitem');
}

function row(dayName: string, time: string) {
  const item = day(dayName).getByText(time).closest('li');
  if (item === null) {
    throw new Error(`No hay reserva a las ${time}`);
  }
  return item;
}

function kpi(label: string) {
  return screen.getByText(label).nextElementSibling?.textContent;
}

/** Cancela en la "base de datos" del servidor la reserva de una franja, como lo haría el paciente. */
function cancelReservationAt(start: Date) {
  const db = readWellbeingDb();
  const reservation = db.reservations.find(
    (candidate) => candidate.startsAt === start.toISOString(),
  );
  const slot = db.slots.find((candidate) => candidate.id === reservation?.slotId);
  if (reservation === undefined || slot === undefined) {
    throw new Error('Reserva semilla no encontrada');
  }
  reservation.status = 'CANCELADA';
  slot.status = 'DISPONIBLE';
  writeWellbeingDb(db);
  return slot;
}

function countAgendaRequests() {
  const requests = vi.fn();
  server.events.on('request:start', ({ request }) => {
    if (request.url.includes(AGENDA_ENDPOINT)) {
      requests();
    }
  });
  return requests;
}

describe('Mi agenda · reservas de la semana (HU-FE-03)', () => {
  beforeEach(() => {
    freezeTime();
  });

  afterEach(() => {
    server.events.removeAllListeners();
  });

  it('es la pantalla de llegada del psicólogo', () => {
    openAgenda();

    expect(screen.getByRole('heading', { level: 1, name: 'Mi agenda' })).toBeInTheDocument();
    expect(screen.getByText('Hoy es miércoles, 23 de septiembre')).toBeInTheDocument();
  });

  it('lista cada reserva con el empleado, el día, la hora y su estado', async () => {
    openAgenda();

    expect(await rowsOf(TODAY)).toHaveLength(4);
    expect(
      screen.getAllByRole('region', { name: /(Lunes|Martes|Miércoles|Jueves|Viernes), \d+ de/ }),
    ).toHaveLength(5);

    const inProgress = within(row(TODAY, '9:00 – 9:50'));
    expect(inProgress.getByText('David Cajamarca')).toBeInTheDocument();
    expect(inProgress.getByText('En curso')).toBeInTheDocument();
    expect(within(row(TODAY, '8:00 – 8:50')).getByText('Finalizada')).toBeInTheDocument();
    expect(within(row(TODAY, '11:00 – 11:50')).getByText('Confirmada')).toBeInTheDocument();

    const monday = within(row('Lunes, 21 de septiembre', '16:00 – 16:50'));
    expect(monday.getByText('Mariana Torres')).toBeInTheDocument();
    expect(monday.getByText('Cancelada')).toBeInTheDocument();
  });

  it('resume la semana y destaca la próxima sesión', async () => {
    openAgenda();
    await rowsOf(TODAY);

    expect(kpi('Sesiones de la semana')).toBe('12');
    expect(kpi('Por atender')).toBe('7');
    expect(kpi('Canceladas')).toBe('4');

    const next = within(screen.getByRole('region', { name: 'Próxima sesión' }));
    expect(next.getByText('David Cajamarca')).toBeInTheDocument();
    expect(next.getByText('Miércoles, 23 de septiembre · 9:00 – 9:50')).toBeInTheDocument();
  });

  it('avisa cuando ya no quedan sesiones por atender esta semana', async () => {
    freezeTime(new Date(2026, 8, 25, 18));
    openAgenda();

    expect(
      await screen.findByText('No tienes más sesiones confirmadas esta semana.'),
    ).toBeInTheDocument();
  });

  it('navega entre semanas y solo muestra la próxima sesión en la semana actual', async () => {
    const { router, user } = openAgenda();
    await rowsOf(TODAY);

    await user.click(screen.getByRole('button', { name: 'Semana siguiente' }));

    expect(router.state.location.search).toBe('?semana=2026-09-28');
    expect(await rowsOf('Lunes, 28 de septiembre')).toHaveLength(3);
    expect(kpi('Sesiones de la semana')).toBe('12');
    expect(kpi('Canceladas')).toBe('3');
    expect(screen.queryByRole('region', { name: 'Próxima sesión' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Esta semana' }));
    expect(await screen.findByRole('region', { name: 'Próxima sesión' })).toBeInTheDocument();
  });

  it('avisa si la semana no tiene reservas', async () => {
    openAgenda('?semana=2026-09-14');

    expect(await screen.findByText('No tienes reservas esta semana.')).toBeInTheDocument();
    expect(kpi('Sesiones de la semana')).toBe('0');
  });

  it('permite reintentar si la carga falla', async () => {
    server.use(
      http.get(`*${AGENDA_ENDPOINT}`, () => new HttpResponse(null, { status: 500 }), {
        once: true,
      }),
    );
    const { user } = openAgenda();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos cargar tu agenda.');

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(await rowsOf(TODAY)).toHaveLength(4);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('lleva a gestionar la disponibilidad', async () => {
    const { router, user } = openAgenda();

    await user.click(screen.getByRole('link', { name: 'Gestionar disponibilidad' }));

    expect(router.state.location.pathname).toBe(PSYCHOLOGIST_PATHS.availability);
  });
});

describe('Mi agenda · en tiempo real (RT-2)', () => {
  beforeEach(() => {
    freezeTime();
  });

  afterEach(() => {
    server.events.removeAllListeners();
  });

  it('se actualiza sola cuando un paciente cancela una de sus sesiones', async () => {
    openAgenda();
    await rowsOf(TODAY);

    const slot = cancelReservationAt(new Date(2026, 8, 23, 11));
    act(() => {
      publishMockEvent(SLOTS_TOPIC, { type: 'ACTUALIZADA', slot });
    });

    await waitFor(() => {
      expect(within(row(TODAY, '11:00 – 11:50')).getByText('Cancelada')).toBeInTheDocument();
    });
    expect(kpi('Canceladas')).toBe('5');
  });

  it('ignora cambios de otros psicólogos, franjas nuevas y mensajes mal formados', async () => {
    const requests = countAgendaRequests();
    openAgenda();
    await rowsOf(TODAY);
    const slot = readWellbeingDb().slots[0];

    act(() => {
      publishMockEvent(SLOTS_TOPIC, {
        type: 'ACTUALIZADA',
        slot: { ...slot, psychologistId: 'otro' },
      });
      publishMockEvent(SLOTS_TOPIC, { type: 'CREADA', slot });
      publishMockEvent(SLOTS_TOPIC, { type: 'ACTUALIZADA' });
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(requests).toHaveBeenCalledTimes(1);
  });

  it('recupera los cambios perdidos al reconectarse', async () => {
    const store = createStatusStore();
    const client: RealtimeClient = {
      connect: () => {
        store.set('connected');
      },
      disconnect: () => {
        store.set('idle');
      },
      subscribe: () => () => undefined,
      getStatus: store.getStatus,
      getRecoveries: store.getRecoveries,
      onChange: store.onChange,
    };
    openAgenda('', () => client);
    await rowsOf(TODAY);

    act(() => {
      store.set('reconnecting');
    });
    // Sin conexión, el aviso de la cancelación se pierde.
    cancelReservationAt(new Date(2026, 8, 23, 11));
    act(() => {
      store.set('connected');
    });

    await waitFor(() => {
      expect(within(row(TODAY, '11:00 – 11:50')).getByText('Cancelada')).toBeInTheDocument();
    });
  });
});
