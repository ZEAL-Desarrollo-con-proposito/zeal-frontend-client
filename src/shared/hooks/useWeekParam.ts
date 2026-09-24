import { useSearchParams } from 'react-router';
import { parseIsoDate, startOfWeek, toIsoDate } from '@/shared/lib/dates';

export const WEEK_PARAM = 'semana';

/**
 * Semana visible guardada en la URL (`?semana=AAAA-MM-DD`): se puede compartir, recargar y usar
 * con los botones atrás/adelante del navegador. Sin parámetro válido, es la semana actual.
 */
export function useWeekParam(): [Date, (week: Date) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = parseIsoDate(searchParams.get(WEEK_PARAM) ?? '');
  const weekStart = startOfWeek(requested ?? new Date());

  function setWeek(week: Date) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set(WEEK_PARAM, toIsoDate(startOfWeek(week)));
      return next;
    });
  }

  return [weekStart, setWeek];
}
