import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RESERVATIONS_ENDPOINT } from '@/features/agenda/api/agendaApi';
import type { Role } from '@/features/auth/model/session';
import { server } from '@/mocks/server';
import type { WellbeingDb } from '@/mocks/wellbeing/db';
import { readWellbeingDb, writeWellbeingDb } from '@/mocks/wellbeing/db';
import { InvalidResponseError } from '@/shared/api/errors';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { freezeTime } from '@/test/clock';
import { buildSession } from '@/test/credentials';
import { bookSlot } from './bookingApi';

const LAURA = 'usr-psicologo-001';
const ANDRES = 'usr-psicologo-002';

function authenticateAs(role: Role) {
  configureHttpAuth({
    accessToken: buildSession(role).accessToken,
    onUnauthorized: () => undefined,
  });
}

function slotIdAt(psychologistId: string, start: Date): string {
  const slot = readWellbeingDb().slots.find(
    (candidate) =>
      candidate.psychologistId === psychologistId && candidate.startsAt === start.toISOString(),
  );
  if (slot === undefined) {
    throw new Error('Franja semilla no encontrada');
  }
  return slot.id;
}

function updateDb(change: (db: WellbeingDb) => void) {
  const db = readWellbeingDb();
  change(db);
  writeWellbeingDb(db);
}

describe('bookingApi.bookSlot', () => {
  beforeEach(() => {
    freezeTime();
    authenticateAs('EMPLEADO');
  });

  afterEach(() => {
    configureHttpAuth(null);
  });

  it('agenda la cita, reserva el bloque y lo guarda a nombre del empleado', async () => {
    const slotId = slotIdAt(ANDRES, new Date(2026, 8, 23, 13));

    const appointment = await bookSlot(slotId);

    expect(appointment).toMatchObject({
      psychologist: { id: ANDRES, fullName: 'Andrés Rojas', title: 'Psicólogo organizacional' },
      startsAt: new Date(2026, 8, 23, 13).toISOString(),
      status: 'CONFIRMADA',
    });
    const db = readWellbeingDb();
    expect(db.slots.find(({ id }) => id === slotId)?.status).toBe('RESERVADA');
    expect(db.reservations.find(({ id }) => id === appointment.id)).toMatchObject({
      slotId,
      employee: { id: 'usr-empleado-001', fullName: 'David Cajamarca' },
    });
  });

  it('rechaza con 409 un bloque que otra persona ya tomó, sin asignarlo dos veces', async () => {
    const slotId = slotIdAt(ANDRES, new Date(2026, 8, 23, 13));
    await bookSlot(slotId);

    await expect(bookSlot(slotId)).rejects.toMatchObject({
      status: 409,
      serverMessage: 'Otra persona reservó este bloque antes que tú. Elige otro bloque libre.',
    });
    expect(
      readWellbeingDb().reservations.filter((reservation) => reservation.slotId === slotId),
    ).toHaveLength(1);
  });

  it('rechaza con 409 un bloque que se cruza con otra cita del empleado', async () => {
    // David ya tiene cita con Laura el miércoles a las 11:00; Andrés abre un bloque a esa hora.
    updateDb((db) => {
      db.slots.push({
        id: 'franja-cruce',
        psychologistId: ANDRES,
        startsAt: new Date(2026, 8, 23, 11, 30).toISOString(),
        endsAt: new Date(2026, 8, 23, 12, 20).toISOString(),
        status: 'DISPONIBLE',
      });
    });

    await expect(bookSlot('franja-cruce')).rejects.toMatchObject({
      status: 409,
      serverMessage: 'Ya tienes una cita que se cruza con ese horario.',
    });
  });

  it('rechaza un bloque que ya empezó o que ya no existe', async () => {
    await expect(bookSlot(slotIdAt(LAURA, new Date(2026, 8, 23, 8)))).rejects.toMatchObject({
      status: 400,
      serverMessage: 'Este bloque ya empezó. Elige otro.',
    });
    await expect(bookSlot('franja-999')).rejects.toMatchObject({
      status: 404,
      serverMessage: 'Este bloque ya no existe. Elige otro.',
    });

    // Un bloque de alguien que ya no está en el directorio tampoco se puede reservar.
    const slotId = slotIdAt(ANDRES, new Date(2026, 8, 23, 17));
    updateDb((db) => {
      db.psychologists = db.psychologists.filter(({ id }) => id !== ANDRES);
    });
    await expect(bookSlot(slotId)).rejects.toMatchObject({ status: 404 });
  });

  it('solo deja agendar a un empleado autenticado', async () => {
    const slotId = slotIdAt(ANDRES, new Date(2026, 8, 23, 13));
    configureHttpAuth(null);
    await expect(bookSlot(slotId)).rejects.toMatchObject({ status: 401 });
    authenticateAs('PSICOLOGO');
    await expect(bookSlot(slotId)).rejects.toMatchObject({ status: 403 });
  });

  it('envía el bloque elegido y valida la respuesta', async () => {
    let body: unknown = null;
    server.use(
      http.post(`*${RESERVATIONS_ENDPOINT}`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 'x' }, { status: 201 });
      }),
    );

    await expect(bookSlot('franja-17')).rejects.toBeInstanceOf(InvalidResponseError);
    expect(body).toEqual({ slotId: 'franja-17' });
  });
});
