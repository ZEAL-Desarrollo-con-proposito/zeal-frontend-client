import { act, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { PSYCHOLOGIST_PATHS, sessionRoomPath } from '@/app/paths';
import { SLOTS_TOPIC } from '@/features/availability/model/slotEvent';
import { publishMockEvent } from '@/mocks/realtime';
import { server } from '@/mocks/server';
import { controlClock, freezeTime, jumpTo } from '@/test/clock';
import { storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import { cancelReservationAt } from '@/test/wellbeing';
import { RESERVATIONS_ENDPOINT } from '../api/agendaApi';

const TODAY = 'Hoy · Miércoles, 23 de septiembre';
const JOIN_DAVID = 'Entrar a la sala con David Cajamarca';
const wednesdayAt = (hour: number, minute = 0) => new Date(2026, 8, 23, hour, minute);

function openAs(path: string) {
  storeSession('PSICOLOGO');
  return renderRoute(path);
}

function nextSessionCard() {
  return within(screen.getByRole('region', { name: 'Próxima sesión' }));
}

function lobby() {
  return screen.getByRole('region', { name: 'Estado de la sala' });
}

async function rowAt(time: string) {
  const today = within(await screen.findByRole('region', { name: TODAY }));
  const item = today.getByText(time).closest('li');
  if (item === null) {
    throw new Error(`No hay reserva a las ${time}`);
  }
  return within(item);
}

describe('Entrar a la sala desde la agenda (HU-FE-03)', () => {
  it('ofrece entrar a la sala de la sesión en curso, desde la tarjeta y desde su fila', async () => {
    freezeTime();
    const { router, user } = openAs(PSYCHOLOGIST_PATHS.agenda);

    const inProgress = await rowAt('9:00 – 9:50');
    expect(inProgress.getByRole('link', { name: JOIN_DAVID })).toHaveAttribute(
      'href',
      sessionRoomPath('reserva-16'),
    );
    expect((await rowAt('11:00 – 11:50')).queryByRole('link')).not.toBeInTheDocument();

    await user.click(nextSessionCard().getByRole('link', { name: JOIN_DAVID }));

    expect(router.state.location.pathname).toBe('/psicologo/agenda/sala/reserva-16');
    expect(
      within(screen.getByRole('navigation', { name: 'Navegación principal' })).getByRole('link', {
        name: 'Mi agenda',
      }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sesión con David Cajamarca' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Miércoles, 23 de septiembre · 9:00 – 9:50')).toBeInTheDocument();
    expect(screen.getByText('En curso')).toBeInTheDocument();
    expect(
      within(lobby()).getByRole('heading', { name: 'La sala está abierta' }),
    ).toBeInTheDocument();
    expect(lobby()).toHaveTextContent(
      'Aquí se mostrará la videollamada con David Cajamarca. La sala cierra a las 9:50.',
    );
    expect(document.title).toBe('Sala de sesión · ZEAL');
  });

  it('habilita el botón por sí solo cuando se abre la ventana de ingreso', async () => {
    controlClock(wednesdayAt(9, 55));
    openAs(PSYCHOLOGIST_PATHS.agenda);

    const button = await screen.findByRole('button', { name: 'Entrar a la sala' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('La sala abre a las 10:50');

    jumpTo(wednesdayAt(10, 50));

    expect(await nextSessionCard().findByRole('link', { name: JOIN_DAVID })).toBeInTheDocument();
    expect((await rowAt('11:00 – 11:50')).getByRole('link')).toBeInTheDocument();
  });
});

describe('Sala de sesión', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('muestra que carga mientras llega la reserva', async () => {
    openAs(sessionRoomPath('reserva-16'));

    expect(screen.getByText('Cargando la sesión…')).toHaveAttribute('aria-busy', 'true');
    expect(await screen.findByRole('region', { name: 'Estado de la sala' })).toBeInTheDocument();
  });

  it('se abre y se cierra sola según la ventana que fijó el servidor', async () => {
    controlClock(wednesdayAt(9, 55));
    openAs(sessionRoomPath('reserva-18'));

    expect(
      await screen.findByRole('heading', { name: 'La sala abre a las 10:50' }),
    ).toBeInTheDocument();
    expect(lobby()).toHaveTextContent('Esta página se habilitará sola cuando llegue la hora');

    jumpTo(wednesdayAt(10, 50));
    expect(
      await screen.findByRole('heading', { name: 'La sala está abierta' }),
    ).toBeInTheDocument();

    jumpTo(wednesdayAt(11, 50));
    expect(await screen.findByRole('heading', { name: 'La sala ya cerró' })).toBeInTheDocument();
    expect(lobby()).toHaveTextContent('La ventana para entrar a esta sesión terminó.');
  });

  it.each([
    ['reserva-7', 'Esta sesión fue cancelada', 'Cancelada'],
    ['reserva-15', 'Esta sesión ya finalizó', 'Finalizada'],
  ])('no ofrece sala para %s: "%s"', async (id, title, badge) => {
    openAs(sessionRoomPath(id));

    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByText(badge)).toBeInTheDocument();
    expect(lobby()).toHaveTextContent('No hay una sala abierta para esta reserva.');
  });

  it('se entera al instante si el paciente cancela mientras se espera', async () => {
    openAs(sessionRoomPath('reserva-18'));
    await screen.findByRole('heading', { name: 'La sala abre a las 10:50' });

    const slot = cancelReservationAt(wednesdayAt(11));
    act(() => {
      publishMockEvent(SLOTS_TOPIC, { type: 'ACTUALIZADA', slot });
    });

    expect(
      await screen.findByRole('heading', { name: 'Esta sesión fue cancelada' }),
    ).toBeInTheDocument();
  });

  it('avisa si la sesión no existe o no es propia, y permite volver a la agenda', async () => {
    const { router, user } = openAs(sessionRoomPath('reserva-999'));

    expect(
      await screen.findByRole('heading', { name: 'No encontramos esta sesión' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Volver a mi agenda' }));

    expect(router.state.location.pathname).toBe(PSYCHOLOGIST_PATHS.agenda);
  });

  it('permite reintentar si la sala no carga', async () => {
    server.use(
      http.get(`*${RESERVATIONS_ENDPOINT}/:id`, () => new HttpResponse(null, { status: 500 }), {
        once: true,
      }),
    );
    const { user } = openAs(sessionRoomPath('reserva-16'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos abrir la sala');

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(
      await screen.findByRole('heading', { name: 'La sala está abierta' }),
    ).toBeInTheDocument();
  });
});
