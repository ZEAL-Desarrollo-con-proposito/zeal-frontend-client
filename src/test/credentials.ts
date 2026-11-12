import type { AuthUser, Role, Session } from '@/features/auth/model/session';
import { sessionStore } from '@/features/auth/storage/sessionStore';
import { createMockToken } from '@/mocks/mockToken';
import { SEED_USERS } from '@/mocks/seedUsers';

export function seedUser(role: Role): AuthUser {
  const user = SEED_USERS.find((candidate) => candidate.role === role);
  if (user === undefined) {
    throw new Error(`No hay usuario semilla con rol ${role}`);
  }
  return user;
}

export function buildSession(role: Role, expiresInMs = 60 * 60 * 1000): Session {
  const user = seedUser(role);
  return { accessToken: createMockToken(user), user, expiresAt: Date.now() + expiresInMs };
}

/** Simula una sesión ya abierta en la pestaña (en memoria), sin pasar por el login. */
export function storeSession(role: Role, { expiresInMs }: { expiresInMs?: number } = {}): Session {
  const session = buildSession(role, expiresInMs);
  sessionStore.save(session);
  return session;
}
