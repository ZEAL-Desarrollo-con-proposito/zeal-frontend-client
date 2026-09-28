import { delay, http, HttpResponse } from 'msw';
import { RESERVATIONS_ENDPOINT } from '@/features/agenda/api/agendaApi';
import { MY_APPOINTMENTS_ENDPOINT } from '@/features/appointments/api/appointmentsApi';
import type { Appointment } from '@/features/appointments/model/appointment';
import { describeSlot } from '@/features/availability/model/slot';
import { SLOTS_TOPIC } from '@/features/availability/model/slotEvent';
import { authorize, errorBody } from '../mockAuth';
import { notify } from '../notifications/db';
import { publishMockEvent } from '../realtime';
import type { PsychologistRecord, ReservationRecord } from './db';
import { nextId, readWellbeingDb, writeWellbeingDb } from './db';
import { openFreedSlotOffer } from './freedSlotsDb';

interface BookingBody {
  slotId?: unknown;
}

/** Cita vista por el empleado. Regla del backend: una cita confirmada que ya terminó se finaliza. */
export function toAppointment(
  record: ReservationRecord,
  psychologist: PsychologistRecord,
  now: number,
): Appointment {
  const finished = record.status === 'CONFIRMADA' && Date.parse(record.endsAt) <= now;
  return {
    id: record.id,
    psychologist: {
      id: psychologist.id,
      fullName: psychologist.fullName,
      title: psychologist.title,
    },
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    status: finished ? 'FINALIZADA' : record.status,
  };
}

function overlaps(record: ReservationRecord, start: number, end: number): boolean {
  return Date.parse(record.startsAt) < end && start < Date.parse(record.endsAt);
}

/*regla que puse para que se pueda cancelar minimo 24 h de plazo */
const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;

export const bookingHandlers = [
  // Citas del empleado autenticado; las de un psicólogo que ya no está en el directorio no se listan.
  http.get(`*${MY_APPOINTMENTS_ENDPOINT}`, async ({ request }) => {
    await delay();
    const user = authorize(request, 'EMPLEADO');
    if (user instanceof Response) {
      return user;
    }
    const db = readWellbeingDb();
    const now = Date.now();
    const appointments = db.reservations
      .filter((reservation) => reservation.employee.id === user.id)
      .flatMap((reservation) => {
        const psychologist = db.psychologists.find(({ id }) => id === reservation.psychologistId);
        return psychologist === undefined ? [] : [toAppointment(reservation, psychologist, now)];
      })
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    return HttpResponse.json(appointments);
  }),

  /**
   * Reglas de negocio de la reserva (HU-BE-05). Se validan y se escriben sin pausas intermedias:
   * dos reservas del mismo bloque nunca se aceptan a la vez (la segunda recibe 409).
   */
  http.post<never, BookingBody>(`*${RESERVATIONS_ENDPOINT}`, async ({ request }) => {
    await delay();
    const user = authorize(request, 'EMPLEADO');
    if (user instanceof Response) {
      return user;
    }
    const { slotId } = await request.json();
    const db = readWellbeingDb();
    const slot = db.slots.find(({ id }) => id === slotId);
    const psychologist = db.psychologists.find(({ id }) => id === slot?.psychologistId);
    if (slot === undefined || psychologist === undefined) {
      return errorBody(404, 'Not Found', 'Este bloque ya no existe. Elige otro.');
    }
    const start = Date.parse(slot.startsAt);
    const end = Date.parse(slot.endsAt);
    if (start <= Date.now()) {
      return errorBody(400, 'Bad Request', 'Este bloque ya empezó. Elige otro.');
    }
    if (slot.status !== 'DISPONIBLE') {
      return errorBody(
        409,
        'Conflict',
        'Otra persona reservó este bloque antes que tú. Elige otro bloque libre.',
      );
    }
    const ownAppointments = db.reservations.filter(
      (reservation) => reservation.employee.id === user.id && reservation.status === 'CONFIRMADA',
    );
    if (ownAppointments.some((reservation) => overlaps(reservation, start, end))) {
      return errorBody(409, 'Conflict', 'Ya tienes una cita que se cruza con ese horario.');
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
    publishMockEvent(SLOTS_TOPIC, { type: 'ACTUALIZADA', slot });
    // El servicio de notificaciones confirma la reserva a quien la hizo (HU-BE-06).
    notify(user.id, {
      type: 'RESERVA_CONFIRMADA',
      title: 'Tu cita quedó confirmada',
      message: `${psychologist.fullName} · ${describeSlot(slot)}`,
      link: '/empleado/mis-citas',
    });
    return HttpResponse.json(toAppointment(record, psychologist, Date.now()), { status: 201 });
  }),

  /**
   * Cancela una cita propia (HU-BE-07). Idempotente: si ya estaba cancelada, se devuelve tal cual en vez de fallar.
   * El plazo mínimo se valida en el servidor, nunca en el formulario.
   */
  http.post<{ id: string }>(
    `*${RESERVATIONS_ENDPOINT}/:id/cancelar`,
    async ({ request, params }) => {
      await delay();
      const user = authorize(request, 'EMPLEADO');
      if (user instanceof Response) {
        return user;
      }
      const db = readWellbeingDb();
      const reservation = db.reservations.find(
        (candidate) => candidate.id === params.id && candidate.employee.id === user.id,
      );
      const psychologist = db.psychologists.find(({ id }) => id === reservation?.psychologistId);
      if (reservation === undefined || psychologist === undefined) {
        return errorBody(404, 'Not Found', 'Esta cita ya no existe.');
      }
      if (reservation.status !== 'CONFIRMADA') {
        // Ya cancelada (p. ej. desde otra pestaña): no es un error, se responde igual que la 1.ª vez.
        return HttpResponse.json(toAppointment(reservation, psychologist, Date.now()));
      }
      if (Date.parse(reservation.startsAt) - Date.now() < CANCEL_WINDOW_MS) {
        return errorBody(
          409,
          'Conflict',
          'Ya no puedes cancelar esta cita: faltan menos de 24 horas para que empiece.',
        );
      }

      reservation.status = 'CANCELADA';
      const slot = db.slots.find(({ id }) => id === reservation.slotId);
      if (slot !== undefined) {
        slot.status = 'DISPONIBLE';
      }
      writeWellbeingDb(db);
      if (slot !== undefined) {
        publishMockEvent(SLOTS_TOPIC, { type: 'ACTUALIZADA', slot });
        // Quien tenga una cita posterior ese mismo día recibe la alerta del cupo liberado (HU-BE-08).
        openFreedSlotOffer(db, slot, user.id);
      }
      return HttpResponse.json(toAppointment(reservation, psychologist, Date.now()));
    },
  ),
];
