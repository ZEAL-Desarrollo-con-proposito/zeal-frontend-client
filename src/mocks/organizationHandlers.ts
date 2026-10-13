import { delay, http, HttpResponse } from 'msw';
import { EMPLOYEES_ENDPOINT } from '@/features/organization/api/employeesApi';
import type { Employee } from '@/features/organization/model/employee';
import { authorize } from './mockAuth';
import { SEED_USERS } from './seedUsers';

/** Directorio de la empresa (solo ADMIN): sus empleados con datos de contacto, en orden alfabético. */
export const organizationHandlers = [
  http.get(`*${EMPLOYEES_ENDPOINT}`, async ({ request }) => {
    await delay();
    const admin = authorize(request, 'ADMIN');
    if (admin instanceof Response) {
      return admin;
    }
    const employees: Employee[] = SEED_USERS.filter(
      ({ role, organization }) => role === 'EMPLEADO' && organization === admin.organization,
    )
      .map(({ id, fullName, email }) => ({ id, fullName, email }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
    return HttpResponse.json(employees);
  }),
];
