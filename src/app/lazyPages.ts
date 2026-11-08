import { lazy } from 'react';

/**
 * Carga bajo demanda (HU-FE-24): las pantallas de cada rol y las salas de video son paquetes
 * aparte que se descargan la primera vez que alguien las abre. El paquete inicial solo trae el
 * inicio de sesión y la estructura, y nadie descarga las pantallas de un rol que no es el suyo.
 */
export const SECTIONS = {
  employee: () => import('./sections/employee'),
  psychologist: () => import('./sections/psychologist'),
  admin: () => import('./sections/admin'),
  rooms: () => import('./sections/rooms'),
};

const { employee, psychologist, admin, rooms } = SECTIONS;

export const AppointmentsPage = lazy(() =>
  employee().then((section) => ({ default: section.AppointmentsPage })),
);
export const EmployeeMessagesPage = lazy(() =>
  employee().then((section) => ({ default: section.EmployeeMessagesPage })),
);
export const DirectoryPage = lazy(() =>
  employee().then((section) => ({ default: section.DirectoryPage })),
);
export const PsychologistPage = lazy(() =>
  employee().then((section) => ({ default: section.PsychologistPage })),
);
export const ProjectDetailPage = lazy(() =>
  employee().then((section) => ({ default: section.ProjectDetailPage })),
);
export const ProjectsPage = lazy(() =>
  employee().then((section) => ({ default: section.ProjectsPage })),
);
export const MyWorkshopsPage = lazy(() =>
  employee().then((section) => ({ default: section.MyWorkshopsPage })),
);
export const WorkshopsPage = lazy(() =>
  employee().then((section) => ({ default: section.WorkshopsPage })),
);

export const AgendaPage = lazy(() =>
  psychologist().then((section) => ({ default: section.AgendaPage })),
);
export const AvailabilityPage = lazy(() =>
  psychologist().then((section) => ({ default: section.AvailabilityPage })),
);
export const PsychologistMessagesPage = lazy(() =>
  psychologist().then((section) => ({ default: section.PsychologistMessagesPage })),
);

export const EmployeesPage = lazy(() =>
  admin().then((section) => ({ default: section.EmployeesPage })),
);
export const AdminProjectsPage = lazy(() =>
  admin().then((section) => ({ default: section.AdminProjectsPage })),
);
export const AdminWorkshopsPage = lazy(() =>
  admin().then((section) => ({ default: section.AdminWorkshopsPage })),
);

export const SessionRoomPage = lazy(() =>
  rooms().then((section) => ({ default: section.SessionRoomPage })),
);
export const WorkshopRoomPage = lazy(() =>
  rooms().then((section) => ({ default: section.WorkshopRoomPage })),
);
