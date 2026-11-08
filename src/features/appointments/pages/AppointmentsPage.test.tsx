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

async function openAppointments(search = '') {
  storeSession('EMPLEADO');
  return await renderRoute(`${EMPLOYEE_PATHS.appointments}${search}`);
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

/** Cambia el estado de las citas confirmadas de David en el servidor, salvo `keep`. */
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

/**
 * Adelanta 3 días TODAS las citas confirmadas de David, conservando su orden relativo, para que
 * la que hoy es "la próxima" siga siéndolo pero ahora sea cancelable (>24 h de plazo). Mover solo
 * la más cercana no basta: las demás citas de hoy pasarían a ser la nueva "próxima" y seguirían
 * estando a menos de 24 h.
 */
function moveNextAppointmentToFuture() {
  const db = readWellbeingDb();
  const shiftMs = 3 * 24 * 60 * 60 * 1000;
  let moved = 0;
  for (const reservation of db.reservations) {
    if (reservation.employee.id === DAVID && reservation.status === 'CONFIRMADA') {
      reservation.startsAt = new Date(Date.parse(reservation.startsAt) + shiftMs).toISOString();
      reservation.endsAt = new Date(Date.parse(reservation.endsAt) + shiftMs).toISOString();
      moved += 1;
    }
  }
  if (moved === 0) throw new Error('No hay cita confirmada para mover');
  writeWellbeingDb(db);
}

describe('Mis citas (HU-FE-05)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('muestra la próxima cita destacada y las siguientes, con su estado', async () => {
    await openAppointments();

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
    const { router, user } = await openAppointments();

    await user.click(await tab(/^Historial/));

    expect(router.state.location.search).toBe('?vista=historial');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Historial · 2');
    const history = rows('Historial');
    expect(history[0]).toContain('Mar 22 · 14:00 – 14:50');
    expect(history[1]).toContain('Lun 21 · 15:00 – 15:50');
    expect(history[0]).toContain('Finalizada');
  });

  it('se recorre con el teclado como un grupo de pestañas', async () => {
    const { user } = await openAppointments();
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
    await openAppointments('?vista=historial');
    expect(await tab(/^Historial/)).toHaveAttribute('aria-selected', 'true');
  });

  it('usa Próximas si la pestaña de la URL no existe', async () => {
    await openAppointments('?vista=otra');
    expect(await tab(/^Próximas/)).toHaveAttribute('aria-selected', 'true');
  });

  it('muestra las canceladas y ofrece reservar cuando no quedan citas próximas', async () => {
    cancelDavidAppointments();
    const { user } = await openAppointments();

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
    await openAppointments();

    expect(await tab(/^Próximas · 1$/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Próxima cita' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Siguientes citas' })).not.toBeInTheDocument();
  });

  it('sin citas, explica cómo empezar y lleva al directorio', async () => {
    server.use(http.get(`*${MY_APPOINTMENTS_ENDPOINT}`, () => HttpResponse.json([])));
    await openAppointments();

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
    const { user } = await openAppointments();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos cargar tus citas.');

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(await tab(/^Próximas · 10$/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('muestra al instante una cita agendada desde otra pestaña', async () => {
    await openAppointments();
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

  it('abre el diálogo de cancelar desde la tarjeta destacada', async () => {
    const { user } = await openAppointments();
    await tab(/^Próximas · 10$/);

    const next = within(screen.getByRole('region', { name: 'Próxima cita' }));
    const cancelButton = next.getByRole('button', { name: /Cancelar cita con/i });

    await user.click(cancelButton);

    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByRole('heading', { name: '¿Cancelar esta cita?' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancelar cita' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Volver' })).toBeInTheDocument();
  });

  it('abre el diálogo de cancelar desde una fila de Siguientes citas', async () => {
    const { user } = await openAppointments();
    await tab(/^Próximas · 10$/);

    const list = within(panel().getByRole('list', { name: 'Siguientes citas' }));
    const items = list.getAllByRole('listitem');
    const firstRow = items[0];
    if (firstRow === undefined) throw new Error('No hay filas en Siguientes citas');
    const row = within(firstRow);
    const cancelButton = row.getByRole('button', { name: /Cancelar cita con/i });
    const match = /Cancelar cita con (.+)/.exec(cancelButton.getAttribute('aria-label') ?? '');
    const psychologistName = match?.[1];
    expect(psychologistName).toBeDefined();

    await user.click(cancelButton);

    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByRole('heading', { name: '¿Cancelar esta cita?' }),
    ).toBeInTheDocument();
    expect(dialog).toHaveTextContent(`Tu cita con ${psychologistName}`);

    await user.click(within(dialog).getByRole('button', { name: 'Volver' }));
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  it('al cerrar el diálogo con "Volver" no cancela la cita', async () => {
    const { user } = await openAppointments();
    await tab(/^Próximas · 10$/);

    const next = within(screen.getByRole('region', { name: 'Próxima cita' }));
    await user.click(next.getByRole('button', { name: /Cancelar cita con/i }));

    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Volver' }));

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('tab', { name: /^Canceladas · 0$/ })).toBeInTheDocument();
  });

  it('al confirmar una cita no cancelable, explica la regla y deja reintentar', async () => {
    const { user } = await openAppointments();
    await tab(/^Próximas · 10$/);

    // La cita "En curso" (hoy a las 9:00) no se puede cancelar: faltan <24 h.
    const next = within(screen.getByRole('region', { name: 'Próxima cita' }));
    await user.click(next.getByRole('button', { name: /Cancelar cita con/i }));

    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar cita' }));

    await waitFor(() => {
      expect(within(dialog).getByRole('alert')).toHaveTextContent(/faltan menos de 24 horas/i);
    });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Canceladas · 0$/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Próximas · 10$/ })).toBeInTheDocument();
  });

  it('al confirmar una cita cancelable, avisa y la pasa a Canceladas', async () => {
    moveNextAppointmentToFuture();

    const { user } = await openAppointments();
    await tab(/^Próximas · 10$/);

    const next = within(screen.getByRole('region', { name: 'Próxima cita' }));
    await user.click(next.getByRole('button', { name: /Cancelar cita con/i }));

    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar cita' }));

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(await tab(/^Canceladas · 1$/)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Avisos de tus citas' })).toHaveTextContent(
      /Cancelaste tu cita con/,
    );
  });
});
