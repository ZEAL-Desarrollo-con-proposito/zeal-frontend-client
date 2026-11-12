import type { AuthUser } from '@/features/auth/model/session';

/**
 * Usuarios semilla (no hay registro: HU-01). Solo existen en el API local simulado; en producción
 * los precarga el backend por empresa y la persona entra con su cuenta de Microsoft.
 */

/** Empresa de los usuarios semilla y otra empresa cuyos datos nunca deben verse en la suya. */
export const SEED_ORGANIZATION = 'Nexura S.A.S.';
export const OTHER_ORGANIZATION = 'Órbita Labs S.A.S.';

export const SEED_USERS: readonly AuthUser[] = [
  {
    id: 'usr-empleado-001',
    fullName: 'David Cajamarca',
    email: 'david.cajamarca@nexura.co',
    role: 'EMPLEADO',
    organization: SEED_ORGANIZATION,
  },
  {
    id: 'usr-empleado-002',
    fullName: 'Mariana Torres',
    email: 'mariana.torres@nexura.co',
    role: 'EMPLEADO',
    organization: SEED_ORGANIZATION,
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
    organization: SEED_ORGANIZATION,
  },
  {
    id: 'usr-empleado-003',
    fullName: 'Camilo Rincón',
    email: 'camilo.rincon@nexura.co',
    role: 'EMPLEADO',
    organization: SEED_ORGANIZATION,
  },
  {
    id: 'usr-empleado-004',
    fullName: 'Sofía Mejía',
    email: 'sofia.mejia@nexura.co',
    role: 'EMPLEADO',
    organization: SEED_ORGANIZATION,
  },
  // Segunda empresa cliente: su administradora y sus 4 empleados (aislamiento entre empresas).
  {
    id: 'usr-admin-002',
    fullName: 'Gestión Humana Órbita',
    email: 'gestion.humana@orbitalabs.co',
    role: 'ADMIN',
    organization: OTHER_ORGANIZATION,
  },
  ...(
    [
      ['usr-empleado-101', 'Andrea Gómez', 'andrea.gomez'],
      ['usr-empleado-102', 'Felipe Restrepo', 'felipe.restrepo'],
      ['usr-empleado-103', 'Natalia Vargas', 'natalia.vargas'],
      ['usr-empleado-104', 'Santiago Herrera', 'santiago.herrera'],
    ] as const
  ).map(([id, fullName, user]) => ({
    id,
    fullName,
    email: `${user}@orbitalabs.co`,
    role: 'EMPLEADO' as const,
    organization: OTHER_ORGANIZATION,
  })),
];

/** La cuenta registrada en ZEAL con ese correo de Microsoft, si la hay. */
export function findSeedUserByEmail(email: string): AuthUser | undefined {
  const normalizedEmail = email.trim().toLowerCase();
  return SEED_USERS.find((user) => user.email === normalizedEmail);
}
