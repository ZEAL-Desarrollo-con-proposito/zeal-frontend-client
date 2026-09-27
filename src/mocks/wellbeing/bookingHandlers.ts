import { delay, http, HttpResponse } from 'msw';
import { RESERVATIONS_ENDPOINT } from '@/features/agenda/api/agendaApi';
import type { Appointment } from '@/features/appointments/model/appointment';
import { SLOTS_TOPIC } from '@/features/availability/model/slotEvent';
import { authorize, errorBody } from '../mockAuth';
import { publishMockEvent } from '../realtime';
import type { PsychologistRecord, ReservationRecord } from './db';
import { nextId, readWellbeingDb, writeWellbeingDb } from './db';

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

export const bookingHandlers = [
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
    return HttpResponse.json(toAppointment(record, psychologist, Date.now()), { status: 201 });
  }),
];
