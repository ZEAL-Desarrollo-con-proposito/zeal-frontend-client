import { readWorkshopsDb, writeWorkshopsDb } from '@/mocks/workshops/db';

/**
 * Deja en el servidor simulado solo el taller del administrador semilla (el más reciente): la
 * empresa parte con un único taller publicado. Se llama después de fijar el reloj.
 */
export function keepOnlyAdminSeedWorkshop(): void {
  const db = readWorkshopsDb();
  writeWorkshopsDb({ ...db, workshops: db.workshops.slice(0, 1) });
}
