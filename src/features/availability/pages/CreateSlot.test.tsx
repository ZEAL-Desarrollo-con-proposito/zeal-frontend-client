import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { PSYCHOLOGIST_PATHS } from '@/app/paths';
import { server } from '@/mocks/server';
import { freezeTime } from '@/test/clock';
import { storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import { SLOTS_ENDPOINT } from '../api/availabilityApi';

async function openAvailability() {
  storeSession('PSICOLOGO');
  const rendered = renderRoute(PSYCHOLOGIST_PATHS.availability);
  await wednesday().findAllByRole('listitem');
  return rendered;
}

function wednesday() {
  return within(screen.getByRole('region', { name: 'Miércoles, 23 de septiembre' }));
}

function form() {
  return within(screen.getByRole('region', { name: 'Abrir franja' }));
}

function field(label: 'Día' | 'Desde' | 'Hasta') {
  return form().getByLabelText<HTMLSelectElement>(label);
}

describe('Mi disponibilidad · abrir franja', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('propone hoy de 8:00 a 9:00 y abre la franja elegida', async () => {
    const { user } = await openAvailability();
    expect(field('Día').value).toBe('2026-09-23');
    expect(field('Desde').value).toBe('08:00');
    expect(field('Hasta').value).toBe('09:00');

    await user.selectOptions(field('Desde'), '12:00');
    await user.selectOptions(field('Hasta'), '13:00');
    await user.click(form().getByRole('button', { name: 'Abrir franja' }));

    expect(await wednesday().findByText('12:00 – 13:00')).toBeInTheDocument();
    expect(wednesday().getAllByRole('listitem')).toHaveLength(8);
    expect(screen.getByRole('status', { name: 'Avisos de disponibilidad' })).toHaveTextContent(
      'Abriste la franja del miércoles, 23 de septiembre de 12:00 a 13:00.',
    );
  });

  it('no envía un horario incoherente y lo explica junto al campo', async () => {
    const { user } = await openAvailability();

    await user.selectOptions(field('Desde'), '14:00');
    await user.selectOptions(field('Hasta'), '13:00');
    expect(field('Hasta')).toHaveAccessibleDescription(
      'La hora de fin debe ser posterior a la de inicio',
    );

    await user.click(form().getByRole('button', { name: 'Abrir franja' }));

    expect(wednesday().getAllByRole('listitem')).toHaveLength(7);
    expect(form().queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    [
      'se cruza con otra franja',
      { day: '2026-09-23', start: '10:00', end: '10:30' },
      'Ya tienes una franja que se cruza con ese horario',
    ],
    [
      'ya pasó',
      { day: '2026-09-21', start: '08:00', end: '09:00' },
      'No puedes abrir franjas en un horario que ya pasó',
    ],
  ])('muestra el rechazo del servidor cuando la franja %s', async (_case, draft, message) => {
    const { user } = await openAvailability();

    await user.selectOptions(field('Día'), draft.day);
    await user.selectOptions(field('Desde'), draft.start);
    await user.selectOptions(field('Hasta'), draft.end);
    await user.click(form().getByRole('button', { name: 'Abrir franja' }));

    expect(await form().findByRole('alert')).toHaveTextContent(message);

    await user.selectOptions(field('Hasta'), '11:00');
    await waitFor(() => {
      expect(form().queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('avisa si no hay conexión y bloquea el botón mientras envía', async () => {
    let release: () => void = () => undefined;
    server.use(
      http.post(`*${SLOTS_ENDPOINT}`, async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return HttpResponse.error();
      }),
    );
    const { user } = await openAvailability();

    await user.selectOptions(field('Desde'), '17:00');
    await user.selectOptions(field('Hasta'), '18:00');
    await user.click(form().getByRole('button', { name: 'Abrir franja' }));

    expect(form().getByRole('button', { name: 'Abriendo…' })).toBeDisabled();
    release();
    expect(await form().findByRole('alert')).toHaveTextContent(
      'No pudimos conectar con ZEAL. Revisa tu conexión e intenta de nuevo.',
    );
  });

  it('prellena el formulario al tocar una hora libre del calendario', async () => {
    const { user } = await openAvailability();

    await user.click(screen.getByTitle('Abrir franja el jueves, 24 de septiembre a las 13:00'));

    expect(field('Día').value).toBe('2026-09-24');
    expect(field('Desde').value).toBe('13:00');
    expect(field('Hasta').value).toBe('14:00');
    expect(field('Día')).toHaveFocus();
  });

  it('mantiene el día dentro de la semana visible al cambiar de semana', async () => {
    const { user } = await openAvailability();

    await user.selectOptions(field('Día'), '2026-09-25');
    await user.click(screen.getByRole('button', { name: 'Semana siguiente' }));

    expect(field('Día').value).toBe('2026-09-28');
  });
});
