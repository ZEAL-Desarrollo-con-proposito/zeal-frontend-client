import type { AuthUser } from '@/features/auth/model/session';

/**
 * Usuarios semilla del MVP (el MVP no tiene registro: HU-01). Solo existen en el API local
 * simulado; en producción los precarga el backend (HU-BE-01).
 */
export const DEMO_PASSWORD = 'Zeal2026*';

export const SEED_USERS: readonly AuthUser[] = [
  {
    id: 'usr-empleado-001',
    fullName: 'David Cajamarca',
    email: 'david.cajamarca@nexura.co',
    role: 'EMPLEADO',
    organization: 'Nexura S.A.S.',
  },
  {
    id: 'usr-empleado-002',
    fullName: 'Mariana Torres',
    email: 'mariana.torres@nexura.co',
    role: 'EMPLEADO',
    organization: 'Nexura S.A.S.',
  },
  {
    id: 'usr-psicologo-001',
    fullName: 'Laura Martínez',
    email: 'laura.martinez@zeal.co',
    role: 'PSICOLOGO',
    organization: 'ZEAL',
  },
  {
    id: 'usr-admin-001',
    fullName: 'Talento Humano',
    email: 'talento.humano@nexura.co',
    role: 'ADMIN',
    organization: 'Nexura S.A.S.',
  },
];

export function findSeedUser(email: string, password: string): AuthUser | undefined {
  if (password !== DEMO_PASSWORD) {
    return undefined;
  }
  const normalizedEmail = email.trim().toLowerCase();
  return SEED_USERS.find((user) => user.email === normalizedEmail);
}
