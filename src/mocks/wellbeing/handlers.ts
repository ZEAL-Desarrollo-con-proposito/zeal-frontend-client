import { delay, http, HttpResponse } from 'msw';
import { MY_SLOTS_ENDPOINT } from '@/features/availability/api/availabilityApi';
import { compareByStart } from '@/features/availability/model/slot';
import { addDays, parseIsoDate } from '@/shared/lib/dates';
import { authorize, errorBody } from '../mockAuth';
import { readWellbeingDb } from './db';

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

export const wellbeingHandlers = [
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
];
