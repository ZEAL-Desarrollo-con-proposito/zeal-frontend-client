import { delay, http, HttpResponse } from 'msw';
import type { Slot } from '@/features/availability/model/slot';
import { compareByStart } from '@/features/availability/model/slot';
import { PSYCHOLOGISTS_ENDPOINT } from '@/features/directory/api/directoryApi';
import type { Psychologist } from '@/features/directory/model/psychologist';
import { authorize } from '../mockAuth';
import type { PsychologistRecord, WellbeingDb } from './db';
import { readWellbeingDb } from './db';

/** Regla de negocio del backend: un empleado solo puede reservar bloques disponibles y futuros. */
function freeSlotsOf(db: WellbeingDb, psychologistId: string, now: number): Slot[] {
  return db.slots
    .filter(
      (slot) =>
        slot.psychologistId === psychologistId &&
        slot.status === 'DISPONIBLE' &&
        Date.parse(slot.startsAt) > now,
    )
    .sort(compareByStart);
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
];
