import { act, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { psychologistPath } from '@/app/paths';
import type { Slot } from '@/features/availability/model/slot';
import type { SlotEvent } from '@/features/availability/model/slotEvent';
import { SLOTS_TOPIC } from '@/features/availability/model/slotEvent';
import { publishMockEvent } from '@/mocks/realtime';
import { readWellbeingDb, SEED_PSYCHOLOGIST_ID, writeWellbeingDb } from '@/mocks/wellbeing/db';
import { freezeTime } from '@/test/clock';
import { storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';

const WEDNESDAY = 'Bloques del miércoles, 23 de septiembre';
const TAKEN = 'Otra persona acaba de reservar el bloque que elegiste. Elige otro bloque libre.';
const WITHDRAWN = 'El psicólogo retiró el bloque que elegiste. Elige otro bloque libre.';

async function openLaura() {
  storeSession('EMPLEADO');
  const rendered = renderRoute(psychologistPath(SEED_PSYCHOLOGIST_ID));
  await screen.findByRole('heading', { level: 1, name: 'Laura Martínez' });
  await wednesday().findByRole('button', { name: '14:00 – 14:50' });
  return rendered;
}

function wednesday() {
  return within(screen.getByRole('list', { name: WEDNESDAY }));
}

function panel() {
  return within(screen.getByRole('region', { name: 'Tu reserva' }));
}

function dialog() {
  return within(screen.getByRole('alertdialog', { name: '¿Agendar esta cita?' }));
}

function lauraSlotAt(hour: number): Slot {
  const start = new Date(2026, 8, 23, hour).toISOString();
  const slot = readWellbeingDb().slots.find(
    (candidate) =>
      candidate.psychologistId === SEED_PSYCHOLOGIST_ID && candidate.startsAt === start,
  );
  if (slot === undefined) {
    throw new Error('Franja semilla no encontrada');
  }
  return slot;
}

/** Otra sesión cambia el bloque en el servidor, que publica el evento en vivo. */
function anotherSession(event: SlotEvent) {
  const db = readWellbeingDb();
  db.slots = db.slots.filter(({ id }) => id !== event.slot.id);
  if (event.type !== 'ELIMINADA') {
    db.slots.push(event.slot);
  }
  writeWellbeingDb(db);
  act(() => {
    publishMockEvent(SLOTS_TOPIC, event);
  });
}

describe('Agendar cita · estado libre u ocupado en vivo (HU-FE-05)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('marca ocupado el bloque elegido si otra persona lo reserva, y lo explica', async () => {
    const { user } = await openLaura();
    await user.click(wednesday().getByRole('button', { name: '14:00 – 14:50' }));
    await panel().findByRole('heading', { name: 'Resumen de tu reserva' });

    anotherSession({ type: 'ACTUALIZADA', slot: { ...lauraSlotAt(14), status: 'RESERVADA' } });

    expect(await panel().findByRole('alert')).toHaveTextContent(TAKEN);
    expect(panel().getByRole('heading', { name: 'Agenda tu sesión' })).toBeInTheDocument();
    expect(wednesday().queryByRole('button', { name: '14:00 – 14:50' })).not.toBeInTheDocument();
    expect(wednesday().getByText('14:00 – 14:50', { exact: false })).toHaveTextContent('Ocupado');

    // Elegir otro bloque retoma el flujo sin el aviso.
    await user.click(wednesday().getByRole('button', { name: '15:00 – 15:50' }));
    expect(
      await panel().findByRole('heading', { name: 'Resumen de tu reserva' }),
    ).toBeInTheDocument();
    expect(panel().queryByRole('alert')).not.toBeInTheDocument();
  });

  it('avisa en la confirmación abierta que el bloque ya no está libre y no deja confirmarlo', async () => {
    const { user } = await openLaura();
    await user.click(wednesday().getByRole('button', { name: '14:00 – 14:50' }));
    await user.click(await panel().findByRole('button', { name: 'Agendar cita' }));

    anotherSession({ type: 'ACTUALIZADA', slot: { ...lauraSlotAt(14), status: 'RESERVADA' } });

    expect(await dialog().findByRole('alert')).toHaveTextContent(TAKEN);
    expect(dialog().getByRole('button', { name: 'Confirmar cita' })).toBeDisabled();
    // Con la confirmación bloqueada, el foco no se escapa a un botón deshabilitado.
    const choose = dialog().getByRole('button', { name: 'Elegir otro bloque' });
    expect(choose).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(choose).toHaveFocus();

    await user.click(choose);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    const alert = await panel().findByRole('alert');
    expect(alert).toHaveTextContent(TAKEN);
    // Al cerrar el diálogo, el foco pasa al aviso (el botón que lo abrió ya no existe).
    await waitFor(() => {
      expect(alert).toHaveFocus();
    });
    expect(
      readWellbeingDb().reservations.filter(({ slotId }) => slotId === lauraSlotAt(14).id),
    ).toHaveLength(0);
  });

  it('explica si el psicólogo retira el bloque elegido', async () => {
    const { user } = await openLaura();
    await user.click(wednesday().getByRole('button', { name: '14:00 – 14:50' }));
    await panel().findByRole('heading', { name: 'Resumen de tu reserva' });

    anotherSession({ type: 'ELIMINADA', slot: lauraSlotAt(14) });

    expect(await panel().findByRole('alert')).toHaveTextContent(WITHDRAWN);
  });

  it('no suelta la selección cuando cambia otro bloque', async () => {
    const { user } = await openLaura();
    await user.click(wednesday().getByRole('button', { name: '14:00 – 14:50' }));
    await user.click(await panel().findByRole('button', { name: 'Agendar cita' }));

    anotherSession({ type: 'ACTUALIZADA', slot: { ...lauraSlotAt(15), status: 'RESERVADA' } });

    await waitFor(() => {
      expect(wednesday().queryByRole('button', { name: '15:00 – 15:50' })).not.toBeInTheDocument();
    });
    expect(dialog().getByRole('button', { name: 'Confirmar cita' })).toBeEnabled();
    expect(dialog().queryByRole('alert')).not.toBeInTheDocument();
    await user.click(dialog().getByRole('button', { name: 'Cancelar' }));
    expect(wednesday().getByRole('button', { name: '14:00 – 14:50' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
