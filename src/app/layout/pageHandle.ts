import type { UIMatch } from 'react-router';
import { isRecord } from '@/features/auth/model/session';

/** Metadatos que cada ruta del layout declara en su `handle`. */
export interface PageHandle {
  title: string;
}

function isPageHandle(value: unknown): value is PageHandle {
  return isRecord(value) && typeof value.title === 'string';
}

/** Título de la página más específica que lo declare; `null` si ninguna lo hace. */
export function findPageTitle(matches: readonly UIMatch[]): string | null {
  const handle = matches
    .map((match) => match.handle)
    .filter(isPageHandle)
    .at(-1);
  return handle === undefined ? null : handle.title;
}
