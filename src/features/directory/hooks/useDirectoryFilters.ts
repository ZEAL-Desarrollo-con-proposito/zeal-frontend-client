import { useState } from 'react';
import { useSearchParams } from 'react-router';
import type { DirectoryFilters } from '../model/psychologist';

export const QUERY_PARAM = 'q';
export const TOPIC_PARAM = 'tema';
export const TODAY_PARAM = 'hoy';

/**
 * Filtros del directorio guardados en la URL: sobreviven a una recarga y a ir y volver del
 * perfil de un psicólogo. Lo que se escribe vive en estado local para que el campo responda
 * al instante; la URL se actualiza sin llenar el historial.
 */
export function useDirectoryFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQueryState] = useState(() => searchParams.get(QUERY_PARAM) ?? '');

  function update(changes: Record<string, string | null>) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [param, value] of Object.entries(changes)) {
          if (value === null) {
            next.delete(param);
          } else {
            next.set(param, value);
          }
        }
        return next;
      },
      { replace: true },
    );
  }

  const filters: DirectoryFilters = {
    query,
    topic: searchParams.get(TOPIC_PARAM),
    onlyToday: searchParams.get(TODAY_PARAM) === '1',
  };

  return {
    filters,
    setQuery: (value: string) => {
      setQueryState(value);
      update({ [QUERY_PARAM]: value.trim() === '' ? null : value });
    },
    setTopic: (topic: string | null) => {
      update({ [TOPIC_PARAM]: topic });
    },
    setOnlyToday: (onlyToday: boolean) => {
      update({ [TODAY_PARAM]: onlyToday ? '1' : null });
    },
    clear: () => {
      setQueryState('');
      update({ [QUERY_PARAM]: null, [TOPIC_PARAM]: null, [TODAY_PARAM]: null });
    },
  };
}
