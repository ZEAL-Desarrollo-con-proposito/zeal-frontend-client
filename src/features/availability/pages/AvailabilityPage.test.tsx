import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { PSYCHOLOGIST_PATHS } from '@/app/paths';
import { server } from '@/mocks/server';
import { freezeTime } from '@/test/clock';
import { storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import { MY_SLOTS_ENDPOINT } from '../api/availabilityApi';

function openAvailability(search = '') {
  storeSession('PSICOLOGO');
  return renderRoute(`${PSYCHOLOGIST_PATHS.availability}${search}`);
}

function day(name: string) {
  return within(screen.getByRole('region', { name }));
}

function summaryValue(label: string) {
  const summary = within(screen.getByRole('region', { name: 'Esta semana' }));
  return summary.getByText(label).nextElementSibling?.textContent;
}

describe('Mi disponibilidad · calendario semanal', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('muestra la semana actual de lunes a viernes con las franjas de la psicóloga', async () => {
    openAvailability();

    expect(
      screen.getByRole('heading', { level: 2, name: 'Semana del 21 al 25 de septiembre' }),
    ).toBeInTheDocument();
    const wednesday = day('Miércoles, 23 de septiembre');
    expect(await wednesday.findAllByRole('listitem')).toHaveLength(7);
    expect(wednesday.getByText('9:00 – 9:50').nextElementSibling).toHaveTextContent('Reservada');
    expect(wednesday.getByText('10:00 – 10:50').nextElementSibling).toHaveTextContent('Abierta');
    expect(screen.getAllByRole('region', { name: /de septiembre$/ })).toHaveLength(5);
    expect(summaryValue('Abiertas')).toBe('23');
    expect(summaryValue('Reservadas')).toBe('12');
  });

  it('navega entre semanas y lo refleja en la URL', async () => {
    const { router, user } = openAvailability();
    await day('Lunes, 21 de septiembre').findAllByRole('listitem');

    await user.click(screen.getByRole('button', { name: 'Semana siguiente' }));

    expect(router.state.location.search).toBe('?semana=2026-09-28');
    expect(
      screen.getByRole('heading', { name: 'Semana del 28 de septiembre al 2 de octubre' }),
    ).toBeInTheDocument();
    expect(await day('Jueves, 1 de octubre').findAllByRole('listitem')).toHaveLength(7);
    expect(day('Viernes, 2 de octubre').getAllByRole('listitem')).toHaveLength(7);

    await user.click(screen.getByRole('button', { name: 'Esta semana' }));
    expect(router.state.location.search).toBe('?semana=2026-09-21');
  });

  it('abre directamente la semana indicada en la URL y avisa si no hay franjas', async () => {
    const { user } = openAvailability('?semana=2026-09-14');

    expect(
      await screen.findByText('Aún no abres franjas esta semana. Elige un horario para empezar.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Semana anterior' }));
    expect(
      screen.getByRole('heading', { name: 'Semana del 7 al 11 de septiembre' }),
    ).toBeInTheDocument();
  });

  it('permite reintentar si la carga falla', async () => {
    server.use(
      http.get(`*${MY_SLOTS_ENDPOINT}`, () => new HttpResponse(null, { status: 500 }), {
        once: true,
      }),
    );
    const { user } = openAvailability();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos cargar tu disponibilidad.',
    );
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    expect(await day('Martes, 22 de septiembre').findAllByRole('listitem')).toHaveLength(7);
  });
});
