import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPLOYEE_PATHS, psychologistPath } from '@/app/paths';
import { RESERVATIONS_ENDPOINT } from '@/features/agenda/api/agendaApi';
import { PSYCHOLOGISTS_ENDPOINT } from '@/features/directory/api/directoryApi';
import { server } from '@/mocks/server';
import { readWellbeingDb, SEED_PSYCHOLOGIST_ID } from '@/mocks/wellbeing/db';
import { freezeTime } from '@/test/clock';
import { storeSession } from '@/test/credentials';
import { fakeMediaQueryList } from '@/test/media';
import { renderRoute } from '@/test/renderRoute';

const WEDNESDAY = 'Bloques libres del miércoles, 23 de septiembre';

async function openLaura() {
  storeSession('EMPLEADO');
  const rendered = renderRoute(psychologistPath(SEED_PSYCHOLOGIST_ID));
  await screen.findByRole('heading', { level: 1, name: 'Laura Martínez' });
  await within(await screen.findByRole('list', { name: WEDNESDAY })).findByRole('button', {
    name: '10:00 – 10:50',
  });
  return rendered;
}

function wednesdayBlock(time: string) {
  return within(screen.getByRole('list', { name: WEDNESDAY })).getByRole('button', { name: time });
}

function panel() {
  return within(screen.getByRole('region', { name: 'Tu reserva' }));
}

function dialog() {
  return within(screen.getByRole('alertdialog', { name: '¿Agendar esta cita?' }));
}

function summaryValue(label: string) {
  return panel().getByText(label).nextElementSibling?.textContent;
}

async function confirmBooking(user: ReturnType<typeof renderRoute>['user'], time: string) {
  await user.click(wednesdayBlock(time));
  await user.click(await panel().findByRole('button', { name: 'Agendar cita' }));
  await user.click(dialog().getByRole('button', { name: 'Confirmar cita' }));
}

describe('Agendar cita (HU-FE-05)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('resume el bloque elegido y permite soltarlo', async () => {
    const { user } = await openLaura();
    expect(panel().getByRole('heading', { name: 'Agenda tu sesión' })).toBeInTheDocument();

    await user.click(wednesdayBlock('10:00 – 10:50'));

    expect(wednesdayBlock('10:00 – 10:50')).toHaveAttribute('aria-pressed', 'true');
    expect(
      await panel().findByRole('heading', { name: 'Resumen de tu reserva' }),
    ).toBeInTheDocument();
    expect(summaryValue('Profesional')).toBe('Laura Martínez');
    expect(summaryValue('Fecha')).toBe('Miércoles, 23 de septiembre');
    expect(summaryValue('Hora')).toBe('10:00 – 10:50');
    expect(summaryValue('Modalidad')).toBe('Videollamada 1:1');

    await user.click(panel().getByRole('button', { name: 'Cancelar' }));

    expect(wednesdayBlock('10:00 – 10:50')).toHaveAttribute('aria-pressed', 'false');
    expect(await panel().findByRole('heading', { name: 'Agenda tu sesión' })).toBeInTheDocument();
  });

  it('pide confirmación antes de agendar y se puede desistir', async () => {
    const { user } = await openLaura();
    await user.click(wednesdayBlock('14:00 – 14:50'));

    await user.click(await panel().findByRole('button', { name: 'Agendar cita' }));

    expect(
      dialog().getByText(
        'Sesión 1:1 con Laura Martínez el miércoles, 23 de septiembre de 14:00 a 14:50.',
      ),
    ).toBeInTheDocument();
    await user.click(dialog().getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(wednesdayBlock('14:00 – 14:50')).toHaveAttribute('aria-pressed', 'true');
    expect(
      readWellbeingDb().reservations.some(
        ({ startsAt }) => startsAt === new Date(2026, 8, 23, 14).toISOString(),
      ),
    ).toBe(false);
  });

  it('agenda la cita, muestra el resultado y el bloque deja de estar libre', async () => {
    const { user } = await openLaura();

    await confirmBooking(user, '10:00 – 10:50');

    expect(
      await panel().findByRole('heading', { name: 'Tu sesión quedó agendada' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(summaryValue('Profesional')).toBe('Laura Martínez');
    expect(summaryValue('Hora')).toBe('10:00 – 10:50');
    expect(summaryValue('Estado')).toBe('Confirmada');
    expect(panel().getByRole('link', { name: 'Ver mis citas' })).toHaveAttribute(
      'href',
      EMPLOYEE_PATHS.appointments,
    );

    await waitFor(() => {
      expect(
        within(screen.getByRole('list', { name: WEDNESDAY })).queryByRole('button', {
          name: '10:00 – 10:50',
        }),
      ).not.toBeInTheDocument();
    });
    // El perfil se pone al día; la reserva propia no se anuncia como si la hubiera hecho otro.
    expect(await screen.findByText('Próximo bloque libre: Hoy · 14:00')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Avisos de bloques' })).toBeEmptyDOMElement();
    expect(
      readWellbeingDb().reservations.find(
        ({ startsAt, employee }) =>
          startsAt === new Date(2026, 8, 23, 10).toISOString() &&
          employee.id === 'usr-empleado-001',
      )?.status,
    ).toBe('CONFIRMADA');

    await user.click(panel().getByRole('button', { name: 'Agendar otra' }));
    expect(await panel().findByRole('heading', { name: 'Agenda tu sesión' })).toBeInTheDocument();
  });

  it('elegir otro bloque después de agendar muestra su resumen', async () => {
    const { user } = await openLaura();
    await confirmBooking(user, '10:00 – 10:50');
    await panel().findByRole('heading', { name: 'Tu sesión quedó agendada' });

    await user.click(wednesdayBlock('15:00 – 15:50'));

    expect(
      await panel().findByRole('heading', { name: 'Resumen de tu reserva' }),
    ).toBeInTheDocument();
    expect(summaryValue('Hora')).toBe('15:00 – 15:50');
  });

  it('no envía dos veces mientras agenda y deja reintentar si falla la conexión', async () => {
    let release: () => void = () => undefined;
    server.use(
      http.post(
        `*${RESERVATIONS_ENDPOINT}`,
        async () => {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
          return HttpResponse.error();
        },
        { once: true },
      ),
    );
    const { user } = await openLaura();

    await confirmBooking(user, '10:00 – 10:50');
    expect(dialog().getByRole('button', { name: 'Agendando…' })).toBeDisabled();
    expect(dialog().getByRole('button', { name: 'Cancelar' })).toBeDisabled();

    release();
    expect(await dialog().findByRole('alert')).toHaveTextContent(
      'No pudimos conectar con ZEAL. Revisa tu conexión e intenta de nuevo.',
    );

    await user.click(dialog().getByRole('button', { name: 'Confirmar cita' }));
    expect(
      await panel().findByRole('heading', { name: 'Tu sesión quedó agendada' }),
    ).toBeInTheDocument();
  });
});

describe('Agendar cita · resumen al alcance', () => {
  beforeEach(() => {
    freezeTime();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('acerca el resumen al elegir un bloque, sin animar si se pidió reducir movimiento', async () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    const { user } = await openLaura();

    await user.click(wednesdayBlock('10:00 – 10:50'));
    expect(scroll).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'nearest' });

    vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
      fakeMediaQueryList(query, query === '(prefers-reduced-motion: reduce)'),
    );
    await user.click(wednesdayBlock('14:00 – 14:50'));
    expect(scroll).toHaveBeenLastCalledWith({ behavior: 'auto', block: 'nearest' });
  });

  it('deja elegir un bloque aunque el perfil siga cargando', async () => {
    let release: () => void = () => undefined;
    server.use(
      http.get(
        `*${PSYCHOLOGISTS_ENDPOINT}/:id`,
        async () => {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
          return HttpResponse.json({
            id: SEED_PSYCHOLOGIST_ID,
            fullName: 'Laura Martínez',
            title: 'Psicóloga clínica',
            focusAreas: ['Burnout'],
            nextFreeSlot: null,
          });
        },
        { once: true },
      ),
    );
    storeSession('EMPLEADO');
    const { user } = renderRoute(psychologistPath(SEED_PSYCHOLOGIST_ID));
    const wednesday = within(await screen.findByRole('list', { name: WEDNESDAY }));

    await user.click(await wednesday.findByRole('button', { name: '10:00 – 10:50' }));
    expect(wednesdayBlock('10:00 – 10:50')).toHaveAttribute('aria-pressed', 'true');

    release();
    const reservation = within(await screen.findByRole('region', { name: 'Tu reserva' }));
    expect(
      await reservation.findByRole('heading', { name: 'Resumen de tu reserva' }),
    ).toBeInTheDocument();
  });
});
