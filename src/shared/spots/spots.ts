/**
 * Cupos limitados (convocatorias, talleres): los decide el servidor y `version` crece con cada
 * cambio, así el cliente siempre puede saber cuál de dos lecturas es la más nueva.
 */
export interface Spots {
  capacity: number;
  occupied: number;
  version: number;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function isSpots(value: unknown): value is Spots {
  return (
    typeof value === 'object' &&
    value !== null &&
    'capacity' in value &&
    isCount(value.capacity) &&
    'occupied' in value &&
    isCount(value.occupied) &&
    'version' in value &&
    isCount(value.version)
  );
}

/** Cupos que quedan; nunca negativo aunque el servidor reporte más ocupados que capacidad. */
export function availableSpots({ capacity, occupied }: Spots): number {
  return Math.max(capacity - occupied, 0);
}

/**
 * Los cupos más recientes entre lo que se cargó y lo que llegó en vivo: gana la versión mayor,
 * así un aviso atrasado nunca pisa una respuesta más nueva (ni al revés).
 */
export function latestSpots(loaded: Spots, live: Spots | null): Spots {
  const newest = live !== null && live.version > loaded.version ? live : loaded;
  return { capacity: newest.capacity, occupied: newest.occupied, version: newest.version };
}
