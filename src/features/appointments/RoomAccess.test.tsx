import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { EMPLOYEE_PATHS, employeeRoomPath } from '@/app/paths';
import { server } from '@/mocks/server';
import { freezeTime } from '@/test/clock';
import { storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import { MY_APPOINTMENTS_ENDPOINT } from './api/appointmentsApi';

function nextAppointment() {
  return screen.findByRole('region', { name: 'Próxima cita' });
}

describe('Acceso a la sala desde Mis citas (HU-FE-12)', () => {
  beforeEach(() => {
    freezeTime();
    storeSession('EMPLEADO');
  });

  it('el día de la cita, la próxima cita lleva a su sala', async () => {
    const { router, user } = renderRoute(EMPLOYEE_PATHS.appointments);
    const card = within(await nextAppointment());

    const link = card.getByRole('link', { name: 'Ir a la sala con Laura Martínez' });
    expect(link).toHaveAttribute('href', employeeRoomPath('reserva-16'));

    await user.click(link);
    expect(router.state.location.pathname).toBe('/empleado/mis-citas/sala/reserva-16');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sesión 1:1 · Laura Martínez' }),
    ).toBeInTheDocument();
  });

  it('una cita de otro día todavía no muestra el acceso a la sala', async () => {
    server.use(
      http.get(`*${MY_APPOINTMENTS_ENDPOINT}`, () =>
        HttpResponse.json([
          {
            id: 'reserva-40',
            psychologist: {
              id: 'usr-psicologo-001',
              fullName: 'Laura Martínez',
              title: 'Psicóloga clínica',
            },
            startsAt: new Date(2026, 8, 24, 10).toISOString(),
            endsAt: new Date(2026, 8, 24, 10, 50).toISOString(),
            status: 'CONFIRMADA',
          },
        ]),
      ),
    );
    renderRoute(EMPLOYEE_PATHS.appointments);

    const card = within(await nextAppointment());

    expect(card.getByRole('link', { name: 'Ver el perfil de Laura Martínez' })).toBeInTheDocument();
    expect(card.queryByRole('link', { name: /Ir a la sala/ })).not.toBeInTheDocument();
  });
});
