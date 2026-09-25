import { delay, http, HttpResponse } from 'msw';
import { AGENDA_ENDPOINT, RESERVATIONS_ENDPOINT } from '@/features/agenda/api/agendaApi';
import type { Reservation } from '@/features/agenda/model/reservation';
import { MY_SLOTS_ENDPOINT, SLOTS_ENDPOINT } from '@/features/availability/api/availabilityApi';
import type { Slot } from '@/features/availability/model/slot';
import { compareByStart } from '@/features/availability/model/slot';
import { SLOTS_TOPIC } from '@/features/availability/model/slotEvent';
import { addDays, parseIsoDate } from '@/shared/lib/dates';
import { authorize, errorBody } from '../mockAuth';
import { publishMockEvent } from '../realtime';
import type { ReservationRecord } from './db';
import { nextId, readWellbeingDb, writeWellbeingDb } from './db';

interface NewSlotBody {
  startsAt?: unknown;
  endsAt?: unknown;
}

function readRange(request: Request): { from: Date; to: Date } | null {
  const params = new URL(request.url).searchParams;
  const from = parseIsoDate(params.get('desde') ?? '');
  const to = parseIsoDate(params.get('hasta') ?? '');
  return from === null || to === null ? null : { from, to: addDays(to, 1) };
}

function isWithin(isoDateTime: string, { from, to }: { from: Date; to: Date }): boolean {
  const time = Date.parse(isoDateTime);
  return time >= from.getTime() && time < to.getTime();
}

function parseTime(value: unknown): number {
  return typeof value === 'string' ? Date.parse(value) : Number.NaN;
}

function overlaps(slot: Slot, start: number, end: number): boolean {
  return Date.parse(slot.startsAt) < end && start < Date.parse(slot.endsAt);
}

/** Regla de negocio del backend: la sala abre 10 minutos antes y cierra al terminar la sesión. */
export const JOIN_OPENS_MINUTES_BEFORE = 10;

function toReservation({ id, employee, startsAt, endsAt, status }: ReservationRecord): Reservation {
  const joinable = status === 'CONFIRMADA';
  const opensAt = Date.parse(startsAt) - JOIN_OPENS_MINUTES_BEFORE * 60_000;
  return {
    id,
    employee,
    startsAt,
    endsAt,
    status,
    joinOpensAt: joinable ? new Date(opensAt).toISOString() : null,
    joinClosesAt: joinable ? endsAt : null,
  };
}

export const wellbeingHandlers = [
  // La agenda va antes que /reservas/:id para que "agenda" no se tome como un id.
  http.get(`*${AGENDA_ENDPOINT}`, async ({ request }) => {
    await delay();
    const user = authorize(request, 'PSICOLOGO');
    if (user instanceof Response) {
      return user;
    }
    const range = readRange(request);
    if (range === null) {
      return errorBody(400, 'Bad Request', 'Los parámetros desde y hasta son obligatorios');
    }
    const agenda = readWellbeingDb()
      .reservations.filter(
        (reservation) =>
          reservation.psychologistId === user.id && isWithin(reservation.startsAt, range),
      )
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
      .map(toReservation);
    return HttpResponse.json(agenda);
  }),

  http.get<{ id: string }>(`*${RESERVATIONS_ENDPOINT}/:id`, async ({ request, params }) => {
    await delay();
    const user = authorize(request, 'PSICOLOGO');
    if (user instanceof Response) {
      return user;
    }
    const reservation = readWellbeingDb().reservations.find(
      ({ id, psychologistId }) => id === params.id && psychologistId === user.id,
    );
    if (reservation === undefined) {
      return errorBody(404, 'Not Found', 'Esta sesión no existe o no es tuya');
    }
    return HttpResponse.json(toReservation(reservation));
  }),

  http.get(`*${MY_SLOTS_ENDPOINT}`, async ({ request }) => {
    await delay();
    const user = authorize(request, 'PSICOLOGO');
    if (user instanceof Response) {
      return user;
    }
    const range = readRange(request);
    if (range === null) {
      return errorBody(400, 'Bad Request', 'Los parámetros desde y hasta son obligatorios');
    }
    const slots = readWellbeingDb()
      .slots.filter((slot) => slot.psychologistId === user.id && isWithin(slot.startsAt, range))
      .sort(compareByStart);
    return HttpResponse.json(slots);
  }),

  // Reglas de negocio de apertura de franjas: viven en el servidor, no en el formulario.
  http.post<never, NewSlotBody>(`*${SLOTS_ENDPOINT}`, async ({ request }) => {
    await delay();
    const user = authorize(request, 'PSICOLOGO');
    if (user instanceof Response) {
      return user;
    }
    const body = await request.json();
    const start = parseTime(body.startsAt);
    const end = parseTime(body.endsAt);
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      return errorBody(400, 'Bad Request', 'La hora de fin debe ser posterior a la de inicio');
    }
    if (start < Date.now()) {
      return errorBody(400, 'Bad Request', 'No puedes abrir franjas en un horario que ya pasó');
    }
    const db = readWellbeingDb();
    const own = db.slots.filter((slot) => slot.psychologistId === user.id);
    if (own.some((slot) => overlaps(slot, start, end))) {
      return errorBody(409, 'Conflict', 'Ya tienes una franja que se cruza con ese horario');
    }
    const slot: Slot = {
      id: nextId(db, 'franja'),
      psychologistId: user.id,
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(end).toISOString(),
      status: 'DISPONIBLE',
    };
    db.slots.push(slot);
    writeWellbeingDb(db);
    publishMockEvent(SLOTS_TOPIC, { type: 'CREADA', slot });
    return HttpResponse.json(slot, { status: 201 });
  }),

  http.delete<{ id: string }>(`*${SLOTS_ENDPOINT}/:id`, async ({ request, params }) => {
    await delay();
    const user = authorize(request, 'PSICOLOGO');
    if (user instanceof Response) {
      return user;
    }
    const db = readWellbeingDb();
    const slot = db.slots.find(
      ({ id, psychologistId }) => id === params.id && psychologistId === user.id,
    );
    if (slot === undefined) {
      return errorBody(404, 'Not Found', 'La franja ya no existe');
    }
    if (slot.status === 'RESERVADA') {
      return errorBody(
        409,
        'Conflict',
        'No puedes eliminar una franja reservada. Pide al paciente reprogramar o cancelar la cita.',
      );
    }
    db.slots = db.slots.filter(({ id }) => id !== slot.id);
    writeWellbeingDb(db);
    publishMockEvent(SLOTS_TOPIC, { type: 'ELIMINADA', slot });
    return new HttpResponse(null, { status: 204 });
  }),
];
