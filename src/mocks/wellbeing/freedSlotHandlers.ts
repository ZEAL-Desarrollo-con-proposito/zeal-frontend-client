import { delay, http, HttpResponse } from 'msw';
import { FREED_SLOTS_ENDPOINT } from '@/features/freedSlots/api/freedSlotsApi';
import { FREED_SLOTS_QUEUE } from '@/features/freedSlots/model/freedSlotEvent';
import { describeSlot } from '@/features/availability/model/slot';
import { SLOTS_TOPIC } from '@/features/availability/model/slotEvent';
import { authorize, errorBody } from '../mockAuth';
import { notify } from '../notifications/db';
import { publishMockEvent, publishToUser } from '../realtime';
import { toAppointment } from './bookingHandlers';
import type { ReservationRecord } from './db';
import { nextId, readWellbeingDb, writeWellbeingDb } from './db';
import { overlaps, readFreedSlotsDb, toOffer, writeFreedSlotsDb } from './freedSlotsDb';

/**
 * Cupos liberados (HU-BE-08):
 * - consultar los que la persona aún puede tomar, para recuperarlos tras reconectar;
 * - tomar uno. La carrera se resuelve como en la reserva normal: validar y escribir ocurren sin
 *   pausas intermedias, así que solo la primera petición gana (200) y las demás reciben 409
 *   "otra persona lo tomó primero".
 */
export const freedSlotHandlers = [
  http.get(`*${FREED_SLOTS_ENDPOINT}`, async ({ request }) => {
    await delay();
    const user = authorize(request, 'EMPLEADO');
    if (user instanceof Response) {
      return user;
    }
    const { psychologists } = readWellbeingDb();
    const now = Date.now();
    const open = readFreedSlotsDb()
      .offers.filter(
        ({ status, recipientIds, expiresAt }) =>
          status === 'ABIERTO' && recipientIds.includes(user.id) && Date.parse(expiresAt) > now,
      )
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    return HttpResponse.json(
      open.flatMap((record) => {
        const psychologist = psychologists.find(({ id }) => id === record.psychologistId);
        return psychologist === undefined ? [] : [toOffer(record, psychologist)];
      }),
    );
  }),

  http.post<{ id: string }>(`*${FREED_SLOTS_ENDPOINT}/:id/tomar`, async ({ request, params }) => {
    await delay();
    const user = authorize(request, 'EMPLEADO');
    if (user instanceof Response) {
      return user;
    }
    const freed = readFreedSlotsDb();
    const offer = freed.offers.find(
      ({ id, recipientIds }) => id === params.id && recipientIds.includes(user.id),
    );
    if (offer === undefined) {
      return errorBody(404, 'Not Found', 'Este cupo ya no está disponible.');
    }
    if (offer.status === 'TOMADO') {
      return errorBody(409, 'Conflict', 'Otra persona tomó este cupo antes que tú.');
    }
    if (Date.parse(offer.expiresAt) <= Date.now()) {
      return errorBody(410, 'Gone', 'El tiempo para tomar este cupo ya venció.');
    }
    const db = readWellbeingDb();
    const slot = db.slots.find(({ id }) => id === offer.slotId);
    const psychologist = db.psychologists.find(({ id }) => id === offer.psychologistId);
    if (slot === undefined || psychologist === undefined) {
      return errorBody(404, 'Not Found', 'Este cupo ya no está disponible.');
    }
    if (slot.status !== 'DISPONIBLE') {
      // Alguien lo reservó desde el directorio mientras tanto.
      return errorBody(409, 'Conflict', 'Otra persona tomó este cupo antes que tú.');
    }
    const start = Date.parse(slot.startsAt);
    const end = Date.parse(slot.endsAt);
    const crossesOwn = db.reservations.some(
      (reservation) =>
        reservation.employee.id === user.id &&
        reservation.status === 'CONFIRMADA' &&
        overlaps(reservation, start, end),
    );
    if (crossesOwn) {
      return errorBody(400, 'Bad Request', 'Ya tienes una cita que se cruza con ese horario.');
    }

    slot.status = 'RESERVADA';
    const record: ReservationRecord = {
      id: nextId(db, 'reserva'),
      slotId: slot.id,
      psychologistId: slot.psychologistId,
      employee: { id: user.id, fullName: user.fullName },
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      status: 'CONFIRMADA',
    };
    db.reservations.push(record);
    writeWellbeingDb(db);
    offer.status = 'TOMADO';
    offer.takenBy = user.id;
    writeFreedSlotsDb(freed);

    publishMockEvent(SLOTS_TOPIC, { type: 'ACTUALIZADA', slot });
    // Quienes competían se enteran al instante de que ya no está.
    for (const recipientId of offer.recipientIds) {
      if (recipientId !== user.id) {
        publishToUser(recipientId, FREED_SLOTS_QUEUE, { type: 'TOMADO', offerId: offer.id });
      }
    }
    notify(user.id, {
      type: 'RESERVA_CONFIRMADA',
      title: 'Tu cita quedó confirmada',
      message: `${psychologist.fullName} · ${describeSlot(slot)}`,
      link: '/empleado/mis-citas',
    });
    return HttpResponse.json(toAppointment(record, psychologist, Date.now()));
  }),
];
