/**
 * "Base de datos" de presencia del simulador (HU-BE-10): quién está conectado al Real-Time
 */
type PresenceDb = Record<string, 'online' | 'offline'>;

export const PRESENCE_DB_KEY = 'zeal.mock.presencia';

function isPresenceDb(value: unknown): value is PresenceDb {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPresenceDb(): PresenceDb {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(PRESENCE_DB_KEY) ?? 'null');
    if (isPresenceDb(stored)) {
      return stored;
    }
  } catch {
    // Datos corruptos: se empieza de cero.
  }
  return {};
}

export function setPresence(userId: string, status: 'online' | 'offline'): void {
  const db = readPresenceDb();
  db[userId] = status;
  localStorage.setItem(PRESENCE_DB_KEY, JSON.stringify(db));
}

/** Sin una conexión registrada, se asume desconectada (nunca "en línea"). */
export function presenceOf(userId: string): 'online' | 'offline' {
  return readPresenceDb()[userId] ?? 'offline';
}
