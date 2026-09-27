import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { psychologistPath } from '@/app/paths';
import type { WellbeingDb } from '@/mocks/wellbeing/db';
import { readWellbeingDb, SEED_PSYCHOLOGIST_ID, writeWellbeingDb } from '@/mocks/wellbeing/db';
import { freezeTime } from '@/test/clock';
import { storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';

const WEDNESDAY = 'Bloques del miércoles, 23 de septiembre';
const at = (hour: number, minute = 0) => new Date(2026, 8, 23, hour, minute).toISOString();

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

/** Cambio en el servidor cuyo evento en vivo todavía no llega a esta pestaña. */
function serverChangesSilently(change: (db: WellbeingDb) => void) {
  const db = readWellbeingDb();
  change(db);
  writeWellbeingDb(db);
}

function lauraSlotAt(db: WellbeingDb, start: string) {
  const slot = db.slots.find(
    (candidate) =>
      candidate.psychologistId === SEED_PSYCHOLOGIST_ID && candidate.startsAt === start,
  );
  if (slot === undefined) {
    throw new Error('Franja semilla no encontrada');
  }
  return slot;
}

async function tryToBook(user: ReturnType<typeof renderRoute>['user'], time: string) {
  await user.click(wednesday().getByRole('button', { name: time }));
  await user.click(await panel().findByRole('button', { name: 'Agendar cita' }));
  await user.click(dialog().getByRole('button', { name: 'Confirmar cita' }));
}

describe('Agendar cita · conflicto con el servidor (HU-FE-05)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('si otra persona tomó el bloque primero, lo dice con claridad y muestra la semana real', async () => {
    const { user } = await openLaura();
    // Otra persona confirmó las 14:00 un instante antes; su evento aún no llega.
    serverChangesSilently((db) => {
      lauraSlotAt(db, at(14)).status = 'RESERVADA';
    });

    await tryToBook(user, '14:00 – 14:50');

    const alert = await panel().findByRole('alert');
    expect(alert).toHaveTextContent(
      'Otra persona reservó este bloque antes que tú. Elige otro bloque libre.',
    );
    expect(alert).toHaveFocus();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(wednesday().queryByRole('button', { name: '14:00 – 14:50' })).not.toBeInTheDocument();
    });
    expect(
      readWellbeingDb().reservations.some(
        ({ startsAt, employee }) => startsAt === at(14) && employee.id === 'usr-empleado-001',
      ),
    ).toBe(false);

    // Elegir otro bloque retoma el flujo normal.
    await user.click(wednesday().getByRole('button', { name: '15:00 – 15:50' }));
    expect(
      await panel().findByRole('heading', { name: 'Resumen de tu reserva' }),
    ).toBeInTheDocument();
  });

  it('explica cuando el bloque se cruza con otra cita del empleado', async () => {
    // David ya tiene cita con Laura el miércoles a las 11:00; aparece un bloque libre a las 11:30.
    serverChangesSilently((db) => {
      db.slots.push({
        id: 'franja-cruce',
        psychologistId: SEED_PSYCHOLOGIST_ID,
        startsAt: at(11, 30),
        endsAt: at(12, 20),
        status: 'DISPONIBLE',
      });
    });
    const { user } = await openLaura();

    await tryToBook(user, '11:30 – 12:20');

    expect(await panel().findByRole('alert')).toHaveTextContent(
      'Ya tienes una cita que se cruza con ese horario.',
    );
    // El bloque sigue libre para otras personas.
    expect(await wednesday().findByRole('button', { name: '11:30 – 12:20' })).toBeInTheDocument();
  });

  it('explica cuando el bloque ya no existe y lo retira de la semana', async () => {
    const { user } = await openLaura();
    serverChangesSilently((db) => {
      const slot = lauraSlotAt(db, at(15));
      db.slots = db.slots.filter(({ id }) => id !== slot.id);
    });

    await tryToBook(user, '15:00 – 15:50');

    expect(await panel().findByRole('alert')).toHaveTextContent(
      'Este bloque ya no existe. Elige otro.',
    );
    await waitFor(() => {
      expect(wednesday().queryByText('15:00 – 15:50')).not.toBeInTheDocument();
    });
  });
});
