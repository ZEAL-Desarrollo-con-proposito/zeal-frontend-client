import { useEffect, useReducer, useRef, useState } from 'react';
import type { ApiError } from '@/shared/api/errors';
import { isForbidden } from '@/shared/api/errors';
import { useRealtimeStatus, useRealtimeSubscription } from '@/shared/realtime/useRealtime';
import { fetchAdminWorkshops } from '../api/adminWorkshopsApi';
import type { Workshop } from '../model/workshop';
import { compareByNewest } from '../model/workshop';
import { adminWorkshopsReducer, INITIAL_ADMIN_WORKSHOPS_STATE } from '../model/adminWorkshopsState';
import { isWorkshopPublishedEvent, WORKSHOPS_QUEUE } from '../model/workshopEvent';

interface AdminWorkshopsOptions {
  /** Un taller que aún no se conocía llegó en vivo (lo publicó otro administrador). */
  onRemotePublished?: (workshop: Workshop) => void;
}

/**
 * Talleres publicados de la organización, al día en tiempo real:
 * Un 403 no se reintenta: se lanza para que la ruta muestre "Permiso denegado".
 */
export function useAdminWorkshops({ onRemotePublished }: AdminWorkshopsOptions = {}) {
  const [state, dispatch] = useReducer(adminWorkshopsReducer, INITIAL_ADMIN_WORKSHOPS_STATE);
  const [attempt, setAttempt] = useState(0);
  const [denied, setDenied] = useState<ApiError | null>(null);
  const { recoveries } = useRealtimeStatus();
  const requestCounter = useRef(0);
  /** Ids ya conocidos: el eco de lo publicado aquí no se anuncia como si fuera de otra sesión. */
  const knownIds = useRef(new Set<string>());

  useEffect(() => {
    requestCounter.current += 1;
    const requestId = requestCounter.current;
    const controller = new AbortController();
    dispatch({ type: 'load-start', requestId });
    fetchAdminWorkshops(controller.signal).then(
      (workshops) => {
        workshops.forEach(({ id }) => knownIds.current.add(id));
        dispatch({ type: 'load-success', requestId, workshops });
      },
      (error: unknown) => {
        if (isForbidden(error)) {
          setDenied(error);
          return;
        }
        dispatch({ type: 'load-failure', requestId });
      },
    );
    return () => {
      controller.abort();
    };
  }, [attempt, recoveries]);

  useRealtimeSubscription(WORKSHOPS_QUEUE, (payload) => {
    if (!isWorkshopPublishedEvent(payload)) {
      return;
    }
    const isUnknown = !knownIds.current.has(payload.workshop.id);
    knownIds.current.add(payload.workshop.id);
    dispatch({ type: 'published', workshop: payload.workshop });
    if (isUnknown) {
      onRemotePublished?.(payload.workshop);
    }
  });

  if (denied !== null) {
    throw denied;
  }

  return {
    status: state.status,
    workshops: [...state.workshops].sort(compareByNewest),
    retry: () => {
      setAttempt((current) => current + 1);
    },
    /** Aplica un taller confirmado por el servidor (idempotente). */
    addWorkshop: (workshop: Workshop) => {
      knownIds.current.add(workshop.id);
      dispatch({ type: 'published', workshop });
    },
  };
}
