import { fetchAdminProjects } from '@/features/projects/api/adminProjectsApi';
import type { AdminProject } from '@/features/projects/model/adminProject';
import { fetchAdminWorkshops } from '@/features/workshops/api/adminWorkshopsApi';
import type { Workshop } from '@/features/workshops/model/workshop';
import type { Employee } from '../model/employee';
import { fetchEmployees } from './employeesApi';

/** Lo que la empresa tiene hoy en ZEAL: personas, convocatorias y talleres (solo de su organización). */
export interface OrganizationOverview {
  employees: Employee[];
  projects: AdminProject[];
  workshops: Workshop[];
}

/** Pide en paralelo lo que necesitan Organización y Reportes; si algo falla, falla todo. */
export async function fetchOrganizationOverview(
  signal: AbortSignal,
): Promise<OrganizationOverview> {
  const [employees, projects, workshops] = await Promise.all([
    fetchEmployees(signal),
    fetchAdminProjects(signal),
    fetchAdminWorkshops(signal),
  ]);
  return { employees, projects, workshops };
}
