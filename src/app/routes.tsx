import type { ReactElement } from 'react';
import type { Role } from '@/features/auth/model/session';
import type { RouteObject } from 'react-router';
import { Navigate } from 'react-router';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { ROLES } from '@/features/auth/model/session';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { AgendaPage } from '@/features/agenda/pages/AgendaPage';
import { AppointmentsPage } from '@/features/appointments/pages/AppointmentsPage';
import { AvailabilityPage } from '@/features/availability/pages/AvailabilityPage';
import { DirectoryPage } from '@/features/directory/pages/DirectoryPage';
import { PsychologistPage } from '@/features/directory/pages/PsychologistPage';
import { SessionRoomPage } from '@/features/sessionRoom/pages/SessionRoomPage';
import { AppLayout } from './layout/AppLayout';
import type { PageHandle } from './layout/pageHandle';
import { NAVIGATION } from './navigation';
import { ForbiddenBoundary } from './pages/ForbiddenBoundary';
import { ForbiddenPage } from './pages/ForbiddenPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SectionPage } from './pages/SectionPage';
import { UnexpectedErrorPage } from './pages/UnexpectedErrorPage';
import { EMPLOYEE_PATHS, PATHS, PSYCHOLOGIST_PATHS, ROLE_BASE_PATH, ROLE_HOME_PATH } from './paths';
import { RootLayout } from './RootLayout';
import { EmployeeMessagesPage } from '@/features/chat/pages/EmployeeMessagesPage';
import { PsychologistMessagesPage } from '@/features/chat/pages/PsychologistMessagesPage';

/** Secciones del menú que ya tienen su pantalla; el resto muestra su estado vacío. */
const SECTION_PAGES: Partial<Record<string, ReactElement>> = {
  [PSYCHOLOGIST_PATHS.agenda]: <AgendaPage />,
  [PSYCHOLOGIST_PATHS.availability]: <AvailabilityPage />,
  [PSYCHOLOGIST_PATHS.messages]: <PsychologistMessagesPage />,
  [EMPLOYEE_PATHS.wellbeing]: <DirectoryPage />,
  [EMPLOYEE_PATHS.appointments]: <AppointmentsPage />,
  [EMPLOYEE_PATHS.messages]: <EmployeeMessagesPage />,
};

/** Pantallas de un rol que no están en el menú (se llega a ellas desde otra pantalla). */
const ROLE_ROUTES: Partial<Record<Role, RouteObject[]>> = {
  EMPLEADO: [
    {
      path: EMPLOYEE_PATHS.psychologist,
      handle: { title: 'Perfil del psicólogo' } satisfies PageHandle,
      element: <PsychologistPage />,
    },
  ],
};

/** Pantallas de un rol a pantalla completa, sin barra lateral (la sala de la sesión, Figma C2). */
const FULLSCREEN_ROUTES: Partial<Record<Role, RouteObject[]>> = {
  EMPLEADO: [
    {
      path: EMPLOYEE_PATHS.sessionRoom,
      element: (
        <SessionRoomPage exit={{ to: EMPLOYEE_PATHS.appointments, label: 'Volver a mis citas' }} />
      ),
    },
  ],
  PSICOLOGO: [
    {
      path: PSYCHOLOGIST_PATHS.sessionRoom,
      element: (
        <SessionRoomPage exit={{ to: PSYCHOLOGIST_PATHS.agenda, label: 'Volver a mi agenda' }} />
      ),
    },
  ],
};

function sectionElement(path: string, isHome: boolean, fallback: ReactElement): ReactElement {
  return SECTION_PAGES[path] ?? (isHome ? <HomePage /> : fallback);
}

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <UnexpectedErrorPage />,
    children: [
      { path: PATHS.root, element: <Navigate to={PATHS.login} replace /> },
      { path: PATHS.login, element: <LoginPage /> },
      ...ROLES.map((role) => ({
        element: <ProtectedRoute role={role} forbidden={<ForbiddenPage />} />,
        errorElement: <ForbiddenBoundary />,
        children: [
          {
            element: <AppLayout />,
            children: [
              ...NAVIGATION[role].map((section) => {
                const handle: PageHandle = { title: section.label };
                return {
                  path: section.path,
                  handle,
                  element: sectionElement(
                    section.path,
                    section.path === ROLE_HOME_PATH[role],
                    <SectionPage section={section} />,
                  ),
                };
              }),
              ...(ROLE_ROUTES[role] ?? []),
            ],
          },
          ...(FULLSCREEN_ROUTES[role] ?? []),
          // Toda dirección bajo el prefijo pasa por el control del rol: un enlace a una pantalla de
          // otro rol (p. ej. el chat de un empleado) da "Permiso denegado" aunque no exista.
          { path: `${ROLE_BASE_PATH[role]}/*`, element: <NotFoundPage /> },
        ],
      })),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
