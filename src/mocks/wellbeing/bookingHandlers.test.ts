import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Slot } from '@/features/availability/model/slot';
import { claimEndpoint } from '@/features/freedSlots/api/freedSlotsApi';
import { FREED_SLOTS_QUEUE } from '@/features/freedSlots/model/freedSlotEvent';
import { freezeTime } from '@/test/clock';
import { arrangeFreedSlotCompetition, MARIANA } from '@/test/wellbeing';
import { createMockToken } from '../mockToken';
import { createMockRealtimeClient } from '../realtime';
import { SEED_USERS } from '../seedUsers';
import type { ReservationRecord, WellbeingDb } from './db';
import { readWellbeingDb, SEED_PSYCHOLOGIST_ID, writeWellbeingDb } from './db';
import {
  OFFER_WINDOW_MS,
  openFreedSlotOffer,
  readFreedSlotsDb,
  recipientsOf,
} from './freedSlotsDb';

const DAVID = 'usr-empleado-001';
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 8, day, hour, minute).toISOString();

function tokenOf(userId: string): string {
  const user = SEED_USERS.find(({ id }) => id === userId);
  if (user === undefined) {
    throw new Error(`Usuario semilla ${userId} no existe`);
  }
  return createMockToken(user);
}

function claim(offerId: string, userId = DAVID) {
  return fetch(new URL(claimEndpoint(offerId), window.location.origin), {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenOf(userId)}` },
  });
}

function reservation(
  id: string,
  employeeId: string,
  startsAt: string,
  endsAt: string,
  status: ReservationRecord['status'] = 'CONFIRMADA',
): ReservationRecord {
  return {
    id,
    slotId: `franja-${id}`,
    psychologistId: SEED_PSYCHOLOGIST_ID,
    employee: { id: employeeId, fullName: employeeId },
    startsAt,
    endsAt,
    status,
  };
}

function slotOf(db: WellbeingDb, slotId: string): Slot {
  const slot = db.slots.find(({ id }) => id === slotId);
  if (slot === undefined) {
    throw new Error('Franja no encontrada');
  }
  return slot;
}

const freed: Slot = {
  id: 'franja-liberada',
  psychologistId: SEED_PSYCHOLOGIST_ID,
  startsAt: at(25, 8),
  endsAt: at(25, 8, 50),
  status: 'DISPONIBLE',
};

describe('recipientsOf (regla del simulador, HU-BE-08)', () => {
  const db = (reservations: ReservationRecord[]): WellbeingDb => ({
    psychologists: [],
    slots: [],
    reservations,
    sequence: 0,
  });

  it('ofrece el cupo a quien tiene una cita posterior el mismo día, sin repetir personas', () => {
    const reservations = [
      reservation('1', 'ana', at(25, 14), at(25, 14, 50)),
      reservation('2', 'ana', at(25, 15), at(25, 15, 50)),
      reservation('3', 'beto', at(25, 9), at(25, 9, 50)),
    ];

    expect(recipientsOf(db(reservations), freed, 'nadie')).toEqual(['ana', 'beto']);
  });

  it('excluye a quien lo liberó, las citas de otro día, anteriores o que no están confirmadas', () => {
    const reservations = [
      reservation('1', 'quien-libero', at(25, 14), at(25, 14, 50)),
      reservation('2', 'otro-dia', at(28, 14), at(28, 14, 50)),
      reservation('3', 'anterior', at(25, 7), at(25, 7, 50)),
      reservation('4', 'cancelada', at(25, 14), at(25, 14, 50), 'CANCELADA'),
      reservation('5', 'finalizada', at(25, 14), at(25, 14, 50), 'FINALIZADA'),
    ];

    expect(recipientsOf(db(reservations), freed, 'quien-libero')).toEqual([]);
  });

  it('excluye a quien ya tiene una cita que se cruza con el cupo', () => {
    const reservations = [
      reservation('1', 'ana', at(25, 14), at(25, 14, 50)),
      reservation('2', 'ana', at(25, 8, 30), at(25, 9, 20)),
    ];

    expect(recipientsOf(db(reservations), freed, 'nadie')).toEqual([]);
  });
});

describe('cupos liberados en el simulador (HU-BE-08)', () => {
  beforeEach(() => {
    freezeTime();
  });

  /**
   * Mariana cancela su cita del viernes 8:00 (la franja queda libre) y el cupo se ofrece a David,
   * que tiene una cita a las 14:00. Todo queda escrito en el simulador, como al cancelar de verdad.
   */
  function openOffer() {
    const marianas = arrangeFreedSlotCompetition();
    const db = readWellbeingDb();
    const slot = slotOf(db, marianas.slotId);
    slot.status = 'DISPONIBLE';
    db.reservations = db.reservations.map((record) =>
      record.id === marianas.id ? { ...record, status: 'CANCELADA' } : record,
    );
    writeWellbeingDb(db);
    const offer = openFreedSlotOffer(db, slot, MARIANA);
    if (offer === null) {
      throw new Error('No se abrió el cupo');
    }
    return { offer, slot };
  }

  it('no abre el cupo si nadie tiene una cita posterior ese día', () => {
    const late: Slot = { ...freed, startsAt: at(25, 17), endsAt: at(25, 17, 50) };

    expect(openFreedSlotOffer(readWellbeingDb(), late, MARIANA)).toBeNull();
    expect(readFreedSlotsDb().offers).toEqual([]);
  });

  it('abre el cupo con la ventana que fija el servidor', () => {
    const { offer } = openOffer();

    expect(offer.recipientIds).toContain(DAVID);
    expect(offer.recipientIds).not.toContain(MARIANA);
    expect(Date.parse(offer.expiresAt) - Date.now()).toBe(OFFER_WINDOW_MS);
    expect(offer.status).toBe('ABIERTO');
  });

  it('el primero en tomarlo gana la cita; el segundo recibe 409', async () => {
    const { offer } = openOffer();

    const won = await claim(offer.id);
    expect(won.status).toBe(200);
    expect(await won.json()).toMatchObject({ status: 'CONFIRMADA', startsAt: at(25, 8) });
    expect(readFreedSlotsDb().offers[0]).toMatchObject({ status: 'TOMADO', takenBy: DAVID });

    const lost = await claim(offer.id);
    expect(lost.status).toBe(409);
    expect(await lost.json()).toMatchObject({
      message: 'Otra persona tomó este cupo antes que tú.',
    });
  });

  it('quien lo toma avisa en vivo a los demás competidores', async () => {
    // Otra persona liberó el cupo de las 8:00; David (14:00) y Mariana (16:00) compiten por él.
    const marianas = arrangeFreedSlotCompetition();
    const db = readWellbeingDb();
    db.reservations = db.reservations.map((record) =>
      record.id === marianas.id ? { ...record, status: 'CANCELADA' } : record,
    );
    db.reservations.push(reservation('mariana-tarde', MARIANA, at(25, 16), at(25, 16, 50)));
    const slot = slotOf(db, marianas.slotId);
    slot.status = 'DISPONIBLE';
    writeWellbeingDb(db);
    const offer = openFreedSlotOffer(db, slot, 'usr-empleado-003');
    if (offer === null) {
      throw new Error('No se abrió el cupo');
    }
    expect(offer.recipientIds).toEqual(expect.arrayContaining([DAVID, MARIANA]));

    const heard: unknown[] = [];
    const client = createMockRealtimeClient(tokenOf(MARIANA));
    client.connect();
    client.subscribe(FREED_SLOTS_QUEUE, (payload) => heard.push(payload));

    expect((await claim(offer.id)).status).toBe(200);

    await vi.waitFor(() => {
      expect(heard).toEqual([{ type: 'TOMADO', offerId: offer.id }]);
    });
    client.disconnect();
  });

  it('sin sesión responde 401', async () => {
    const { offer } = openOffer();

    const response = await fetch(new URL(claimEndpoint(offer.id), window.location.origin), {
      method: 'POST',
    });

    expect(response.status).toBe(401);
  });

  it('un cupo que no existe responde 404', async () => {
    openOffer();

    expect((await claim('cupo-99')).status).toBe(404);
  });

  it('un cupo que no era para esa persona se trata como inexistente', async () => {
    const { offer } = openOffer();

    expect((await claim(offer.id, MARIANA)).status).toBe(404);
  });

  it('vencida la ventana, responde 410 y no lo asigna', async () => {
    const { offer } = openOffer();
    vi.setSystemTime(Date.parse(offer.expiresAt) + 1);

    expect((await claim(offer.id)).status).toBe(410);
    expect(readFreedSlotsDb().offers[0]?.status).toBe('ABIERTO');
  });

  it('si alguien lo reservó desde el directorio mientras tanto, responde 409', async () => {
    const { offer, slot } = openOffer();
    const db = readWellbeingDb();
    slotOf(db, slot.id).status = 'RESERVADA';
    writeWellbeingDb(db);

    const response = await claim(offer.id);

    expect(response.status).toBe(409);
    expect(readFreedSlotsDb().offers[0]?.status).toBe('ABIERTO');
  });

  it('si el cupo se cruza con otra cita de quien lo toma, responde 400 y no lo asigna', async () => {
    const { offer } = openOffer();
    const db = readWellbeingDb();
    db.reservations.push(reservation('cruce', DAVID, at(25, 8, 30), at(25, 9, 20)));
    writeWellbeingDb(db);

    expect((await claim(offer.id)).status).toBe(400);
    expect(readFreedSlotsDb().offers[0]?.status).toBe('ABIERTO');
  });

  it('si la franja ya no existe, responde 404', async () => {
    const { offer } = openOffer();
    const db = readWellbeingDb();
    writeWellbeingDb({ ...db, slots: db.slots.filter(({ id }) => id !== offer.slotId) });

    expect((await claim(offer.id)).status).toBe(404);
  });
});
