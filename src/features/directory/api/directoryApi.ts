import { InvalidResponseError } from '@/shared/api/errors';
import { request } from '@/shared/api/httpClient';
import type { Psychologist } from '../model/psychologist';
import { isPsychologist } from '../model/psychologist';

export const PSYCHOLOGISTS_ENDPOINT = '/api/wellbeing/psicologos';

/** Directorio de psicólogos con su próximo bloque libre (HU-04). */
export async function fetchDirectory(signal?: AbortSignal): Promise<Psychologist[]> {
  const payload = await request(PSYCHOLOGISTS_ENDPOINT, { signal });
  if (!Array.isArray(payload) || !payload.every(isPsychologist)) {
    throw new InvalidResponseError('el directorio');
  }
  return payload;
}
