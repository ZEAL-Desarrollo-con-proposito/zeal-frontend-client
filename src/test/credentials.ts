import { DEMO_PASSWORD, SEED_USERS } from '@/mocks/seedUsers';
import type { AuthUser, Role } from '@/features/auth/model/session';

export function seedUser(role: Role): AuthUser {
  const user = SEED_USERS.find((candidate) => candidate.role === role);
  if (user === undefined) {
    throw new Error(`No hay usuario semilla con rol ${role}`);
  }
  return user;
}

export { DEMO_PASSWORD };
