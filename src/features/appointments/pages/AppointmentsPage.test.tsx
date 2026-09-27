import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { EMPLOYEE_PATHS } from '@/app/paths';
import { RESERVATIONS_ENDPOINT } from '@/features/agenda/api/agendaApi';
import { server } from '@/mocks/server';
import { readWellbeingDb, writeWellbeingDb } from '@/mocks/wellbeing/db';
import { freezeTime } from '@/test/clock';
import { buildSession, storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import { MY_APPOINTMENTS_ENDPOINT } from '../api/appointmentsApi';

const DAVID = 'usr-empleado-001';

function openAppointments(search = '') {
  storeSession('EMPLEADO');
  return renderRoute(`${EMPLOYEE_PATHS.appointments}${search}`);
}

async function tab(name: RegExp) {
  return screen.findByRole('tab', { name });
}

function panel() {
  return within(screen.getByRole('tabpanel'));
}

function rows(label: string) {
  return within(panel().getByRole('list', { name: label }))
    .getAllByRole('listitem')
    .map((row) => row.textContent);
}

function cancelDavidAppointments(keep = 0) {
  const db = readWellbeingDb();
  let kept = 0;
  for (const reservation of db.reservations) {
    if (reservation.employee.id === DAVID && reservation.status === 'CONFIRMADA') {
      if (kept < keep && Date.parse(reservation.endsAt) > Date.now()) {
        kept += 1;
      } else {
        reservation.status = 'CANCELADA';
      }
    }
  }
  writeWellbeingDb(db);
}

describe('Mis citas (HU-FE-05)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('muestra la próxima cita destacada y las siguientes, con su estado', async () => {
    openAppointments();

    expect(screen.getByRole('heading', { level: 1, name: 'Mis citas' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Cargando tus citas' })).toBeInTheDocument();
    expect(await tab(/^Próximas · 10$/)).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Historial · 2' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(screen.getByRole('tab', { name: 'Canceladas · 0' })).toBeInTheDocument();

    const next = within(screen.getByRole('region', { name: 'Próxima cita' }));
    expect(next.getByText('En curso')).toBeInTheDocument();
    expect(next.getByText('Laura Martínez')).toBeInTheDocument();
    expect(next.getByText('Hoy · 9:00 – 9:50')).toBeInTheDocument();
    expect(next.getByRole('link', { name: 'Ver el perfil de Laura Martínez' })).toHaveAttribute(
      'href',
      '/empleado/bienestar/psicologos/usr-psicologo-001',
    );

    const later = rows('Siguientes citas');
    expect(later).toHaveLength(9);
    expect(later[0]).toContain('Hoy · 11:00 – 11:50');
    expect(later[0]).toContain('Confirmada');
  });

  it('cambia de pestaña, lo guarda en la URL y muestra el historial más reciente primero', async () => {
    const { router, user } = openAppointments();

    await user.click(await tab(/^Historial/));

    expect(router.state.location.search).toBe('?vista=historial');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Historial · 2');
    const history = rows('Historial');
    expect(history[0]).toContain('Mar 22 · 14:00 – 14:50');
    expect(history[1]).toContain('Lun 21 · 15:00 – 15:50');
    expect(history[0]).toContain('Finalizada');
  });

  it('se recorre con el teclado como un grupo de pestañas', async () => {
    const { user } = openAppointments();
    const upcoming = await tab(/^Próximas/);
    await user.click(upcoming);

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /^Historial/ })).toHaveFocus();
    expect(screen.getByRole('tab', { name: /^Historial/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: /^Canceladas/ })).toHaveFocus();
    expect(panel().getByText('No tienes citas canceladas.')).toBeInTheDocument();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /^Próximas/ })).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: /^Canceladas/ })).toHaveFocus();

    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: /^Próximas/ })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('a');
    expect(screen.getByRole('tab', { name: /^Próximas/ })).toHaveFocus();
    expect(screen.getByRole('tab', { name: /^Historial/ })).toHaveAttribute('tabindex', '-1');
  });

  it('abre la pestaña que indica la URL', async () => {
    openAppointments('?vista=historial');
    expect(await tab(/^Historial/)).toHaveAttribute('aria-selected', 'true');
  });

  it('usa Próximas si la pestaña de la URL no existe', async () => {
    openAppointments('?vista=otra');
    expect(await tab(/^Próximas/)).toHaveAttribute('aria-selected', 'true');
  });

  it('muestra las canceladas y ofrece reservar cuando no quedan citas próximas', async () => {
    cancelDavidAppointments();
    const { user } = openAppointments();

    expect(await tab(/^Próximas · 0$/)).toHaveAttribute('aria-selected', 'true');
    expect(panel().getByText('No tienes citas próximas.')).toBeInTheDocument();
    expect(panel().getByRole('link', { name: 'Reservar sesión' })).toHaveAttribute(
      'href',
      EMPLOYEE_PATHS.wellbeing,
    );

    await user.click(screen.getByRole('tab', { name: 'Canceladas · 10' }));
    const cancelled = rows('Canceladas');
    expect(cancelled[0]).toContain('Vie 2 · 10:00 – 10:50');
    expect(cancelled[0]).toContain('Cancelada');
  });

  it('no muestra "Siguientes citas" cuando solo queda una', async () => {
    cancelDavidAppointments(1);
    openAppointments();

    expect(await tab(/^Próximas · 1$/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Próxima cita' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Siguientes citas' })).not.toBeInTheDocument();
  });

  it('sin citas, explica cómo empezar y lleva al directorio', async () => {
    server.use(http.get(`*${MY_APPOINTMENTS_ENDPOINT}`, () => HttpResponse.json([])));
    openAppointments();

    const empty = within(await screen.findByRole('region', { name: 'Todavía no tienes citas' }));
    expect(
      empty.getByText(/Nadie en Nexura S\.A\.S\. verá que la agendaste\./),
    ).toBeInTheDocument();
    expect(empty.getByRole('link', { name: 'Ver profesionales' })).toHaveAttribute(
      'href',
      EMPLOYEE_PATHS.wellbeing,
    );
    expect(
      within(empty.getByRole('list', { name: 'Cómo empezar' })).getAllByRole('listitem'),
    ).toHaveLength(3);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('permite reintentar si las citas no cargan', async () => {
    server.use(
      http.get(`*${MY_APPOINTMENTS_ENDPOINT}`, () => new HttpResponse(null, { status: 500 }), {
        once: true,
      }),
    );
    const { user } = openAppointments();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos cargar tus citas.');

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(await tab(/^Próximas · 10$/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('muestra al instante una cita agendada desde otra pestaña', async () => {
    openAppointments();
    await tab(/^Próximas · 10$/);
    const slot = readWellbeingDb().slots.find(
      (candidate) =>
        candidate.psychologistId === 'usr-psicologo-002' &&
        candidate.startsAt === new Date(2026, 8, 23, 13).toISOString(),
    );

    await act(() =>
      fetch(new URL(RESERVATIONS_ENDPOINT, window.location.origin), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${buildSession('EMPLEADO').accessToken}`,
        },
        body: JSON.stringify({ slotId: slot?.id }),
      }),
    );

    expect(await tab(/^Próximas · 11$/)).toBeInTheDocument();
    await waitFor(() => {
      expect(rows('Siguientes citas')[1]).toContain('Andrés Rojas');
    });
    expect(rows('Siguientes citas')[1]).toContain('Hoy · 13:00 – 13:50');
  });
});
