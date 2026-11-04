import type { FetchOptions } from '@/shared/hooks/useFetch';
import { useFetch } from '@/shared/hooks/useFetch';
import { useRealtimeStatus, useRealtimeSubscription } from './useRealtime';

interface LiveFetchOptions<T> extends FetchOptions {
  /** Qué se pide (p. ej. un rango de fechas): al cambiar se cancela la petición anterior. */
  key: string;
  load: (signal: AbortSignal) => Promise<T>;
  topic: string;
  /** Mensajes en vivo que dejan los datos desactualizados: el servidor recalcula y se vuelven a pedir. */
  isRelevant: (payload: unknown) => boolean;
}

/**
 * Datos del servidor que se mantienen al día: se vuelven a pedir cuando llega un mensaje relevante
 * del Real-Time Gateway o cuando se recupera la conexión (para no perder lo que pasó sin ella).
 */
export function useLiveFetch<T>({
  key,
  load,
  topic,
  isRelevant,
  listing = false,
}: LiveFetchOptions<T>) {
  const { recoveries } = useRealtimeStatus();
  const resource = useFetch(`${key}/${String(recoveries)}`, load, { listing });

  useRealtimeSubscription(topic, (payload) => {
    if (isRelevant(payload)) {
      resource.reload();
    }
  });

  return resource;
}
