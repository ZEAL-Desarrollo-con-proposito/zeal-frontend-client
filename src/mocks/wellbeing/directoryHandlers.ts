import { delay, http, HttpResponse } from 'msw';
import type { Slot } from '@/features/availability/model/slot';
import { compareByStart } from '@/features/availability/model/slot';
import { PSYCHOLOGISTS_ENDPOINT } from '@/features/directory/api/directoryApi';
import type { Psychologist } from '@/features/directory/model/psychologist';
import { authorize, errorBody } from '../mockAuth';
import type { PsychologistRecord, WellbeingDb } from './db';
import { readWellbeingDb } from './db';
import { isWithin, readRange } from './range';

/** Bloques que aún no empiezan, libres u ocupados (sin revelar quién reservó). */
function upcomingSlotsOf(db: WellbeingDb, psychologistId: string, now: number): Slot[] {
  return db.slots
    .filter((slot) => slot.psychologistId === psychologistId && Date.parse(slot.startsAt) > now)
    .sort(compareByStart);
}

/** Regla de negocio del backend: un empleado solo puede reservar bloques disponibles y futuros. */
function freeSlotsOf(db: WellbeingDb, psychologistId: string, now: number): Slot[] {
  return upcomingSlotsOf(db, psychologistId, now).filter((slot) => slot.status === 'DISPONIBLE');
}

function toPsychologist(record: PsychologistRecord, db: WellbeingDb, now: number): Psychologist {
  const next = freeSlotsOf(db, record.id, now)[0];
  return {
    ...record,
    nextFreeSlot: next === undefined ? null : { startsAt: next.startsAt, endsAt: next.endsAt },
  };
}

function soonestSlotTime({ nextFreeSlot }: Psychologist): number {
  return nextFreeSlot === null ? Number.POSITIVE_INFINITY : Date.parse(nextFreeSlot.startsAt);
}

const NOT_FOUND = 'No encontramos a este psicólogo en el directorio';

export const directoryHandlers = [
  // Quien tiene un bloque libre antes aparece primero; quien no tiene ninguno, al final.
  http.get(`*${PSYCHOLOGISTS_ENDPOINT}`, async ({ request }) => {
    await delay();
    const user = authorize(request, 'EMPLEADO');
    if (user instanceof Response) {
      return user;
    }
    const db = readWellbeingDb();
    const directory = db.psychologists
      .map((record) => toPsychologist(record, db, Date.now()))
      .sort((a, b) => soonestSlotTime(a) - soonestSlotTime(b));
    return HttpResponse.json(directory);
  }),

  http.get<{ id: string }>(`*${PSYCHOLOGISTS_ENDPOINT}/:id`, async ({ request, params }) => {
    await delay();
    const user = authorize(request, 'EMPLEADO');
    if (user instanceof Response) {
      return user;
    }
    const db = readWellbeingDb();
    const record = db.psychologists.find(({ id }) => id === params.id);
    if (record === undefined) {
      return errorBody(404, 'Not Found', NOT_FOUND);
    }
    return HttpResponse.json(toPsychologist(record, db, Date.now()));
  }),

  http.get<{ id: string }>(
    `*${PSYCHOLOGISTS_ENDPOINT}/:id/franjas`,
    async ({ request, params }) => {
      await delay();
      const user = authorize(request, 'EMPLEADO');
      if (user instanceof Response) {
        return user;
      }
      const range = readRange(request);
      if (range === null) {
        return errorBody(400, 'Bad Request', 'Los parámetros desde y hasta son obligatorios');
      }
      const db = readWellbeingDb();
      if (!db.psychologists.some(({ id }) => id === params.id)) {
        return errorBody(404, 'Not Found', NOT_FOUND);
      }
      const slots = upcomingSlotsOf(db, params.id, Date.now()).filter((slot) =>
        isWithin(slot.startsAt, range),
      );
      return HttpResponse.json(slots);
    },
  ),
];
