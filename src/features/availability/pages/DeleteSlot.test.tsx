import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { PSYCHOLOGIST_PATHS } from '@/app/paths';
import { server } from '@/mocks/server';
import { readWellbeingDb, writeWellbeingDb } from '@/mocks/wellbeing/db';
import { freezeTime } from '@/test/clock';
import { storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import { SLOTS_ENDPOINT } from '../api/availabilityApi';

const OPEN_SLOT = 'Eliminar franja del miércoles, 23 de septiembre, 10:00 – 10:50 (Abierta)';

async function openAvailability() {
  storeSession('PSICOLOGO');
  const rendered = await renderRoute(PSYCHOLOGIST_PATHS.availability);
  await wednesday().findAllByRole('listitem');
  return rendered;
}

function wednesday() {
  return within(screen.getByRole('region', { name: 'Miércoles, 23 de septiembre' }));
}

function dialog() {
  return within(screen.getByRole('alertdialog', { name: '¿Eliminar esta franja?' }));
}

/** Otra sesión (un empleado) reserva la franja mientras la psicóloga decide eliminarla. */
function reserveInAnotherSession(startsAt: Date) {
  const db = readWellbeingDb();
  const slot = db.slots.find((candidate) => candidate.startsAt === startsAt.toISOString());
  if (slot === undefined) {
    throw new Error('Franja no encontrada en el simulador');
  }
  slot.status = 'RESERVADA';
  writeWellbeingDb(db);
}

describe('Mi disponibilidad · eliminar franja', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('solo las franjas abiertas se pueden eliminar', async () => {
    await openAvailability();

    expect(wednesday().getByRole('button', { name: OPEN_SLOT })).toBeInTheDocument();
    expect(wednesday().queryByRole('button', { name: /9:00 – 9:50/ })).not.toBeInTheDocument();
  });

  it('pide confirmación y elimina la franja', async () => {
    const { user } = await openAvailability();

    await user.click(wednesday().getByRole('button', { name: OPEN_SLOT }));
    expect(dialog().getByText(/miércoles, 23 de septiembre de 10:00 a 10:50/)).toBeInTheDocument();
    expect(dialog().getByRole('button', { name: 'Cancelar' })).toHaveFocus();

    await user.click(dialog().getByRole('button', { name: 'Eliminar franja' }));

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(wednesday().getAllByRole('listitem')).toHaveLength(6);
    });
    expect(screen.getByRole('status', { name: 'Avisos de disponibilidad' })).toHaveTextContent(
      'Eliminaste la franja del miércoles, 23 de septiembre de 10:00 a 10:50.',
    );
  });

  it('se cancela con el botón o con Escape y el foco vuelve a la franja', async () => {
    const { user } = await openAvailability();
    const slotButton = wednesday().getByRole('button', { name: OPEN_SLOT });

    await user.click(slotButton);
    await user.click(dialog().getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(slotButton).toHaveFocus();

    await user.click(slotButton);
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(wednesday().getAllByRole('listitem')).toHaveLength(7);
  });

  it('mantiene el foco dentro del diálogo al tabular', async () => {
    const { user } = await openAvailability();
    await user.click(wednesday().getByRole('button', { name: OPEN_SLOT }));
    const cancel = dialog().getByRole('button', { name: 'Cancelar' });
    const confirm = dialog().getByRole('button', { name: 'Eliminar franja' });

    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
    await user.keyboard('a');
    expect(confirm).toHaveFocus();
  });

  it('si alguien reservó la franja mientras tanto, explica el rechazo y actualiza la semana', async () => {
    const { user } = await openAvailability();
    await user.click(wednesday().getByRole('button', { name: OPEN_SLOT }));

    reserveInAnotherSession(new Date(2026, 8, 23, 10));
    await user.click(dialog().getByRole('button', { name: 'Eliminar franja' }));

    expect(await dialog().findByRole('alert')).toHaveTextContent(
      'No puedes eliminar una franja reservada.',
    );
    await waitFor(() => {
      expect(wednesday().getByText('10:00 – 10:50').nextElementSibling).toHaveTextContent(
        'Reservada',
      );
      expect(wednesday().queryByRole('button', { name: OPEN_SLOT })).not.toBeInTheDocument();
    });
  });

  it('si otra sesión ya la eliminó, la da por eliminada', async () => {
    server.use(
      http.delete(`*${SLOTS_ENDPOINT}/:id`, () =>
        HttpResponse.json({ message: 'La franja ya no existe' }, { status: 404 }),
      ),
    );
    const { user } = await openAvailability();

    await user.click(wednesday().getByRole('button', { name: OPEN_SLOT }));
    await user.click(dialog().getByRole('button', { name: 'Eliminar franja' }));

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('status', { name: 'Avisos de disponibilidad' })).toHaveTextContent(
      'Esa franja ya había sido eliminada.',
    );
  });

  it('sin conexión mantiene el diálogo para reintentar y no se cierra mientras elimina', async () => {
    let release: () => void = () => undefined;
    server.use(
      http.delete(`*${SLOTS_ENDPOINT}/:id`, async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return HttpResponse.error();
      }),
    );
    const { user } = await openAvailability();
    await user.click(wednesday().getByRole('button', { name: OPEN_SLOT }));

    await user.click(dialog().getByRole('button', { name: 'Eliminar franja' }));
    expect(dialog().getByRole('button', { name: 'Eliminando…' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    release();
    expect(await dialog().findByRole('alert')).toHaveTextContent(
      'No pudimos conectar con ZEAL. Revisa tu conexión e intenta de nuevo.',
    );
    expect(dialog().getByRole('button', { name: 'Eliminar franja' })).toBeEnabled();
  });
});
