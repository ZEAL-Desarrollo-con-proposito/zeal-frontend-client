import { addDays, parseIsoDate } from '@/shared/lib/dates';

export interface TimeWindow {
  from: Date;
  to: Date;
}

/** Rango `?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` (ambos inclusive) de una petición; `null` si falta. */
export function readRange(request: Request): TimeWindow | null {
  const params = new URL(request.url).searchParams;
  const from = parseIsoDate(params.get('desde') ?? '');
  const to = parseIsoDate(params.get('hasta') ?? '');
  return from === null || to === null ? null : { from, to: addDays(to, 1) };
}

export function isWithin(isoDateTime: string, { from, to }: TimeWindow): boolean {
  const time = Date.parse(isoDateTime);
  return time >= from.getTime() && time < to.getTime();
}
