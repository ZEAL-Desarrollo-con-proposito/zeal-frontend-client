import type { ReactElement } from 'react';
import type { Role } from '@/features/auth/model/session';
import type { RouteObject } from 'react-router';
import { Navigate } from 'react-router';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { ROLES } from '@/features/auth/model/session';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { AgendaPage } from '@/features/agenda/pages/AgendaPage';
import { SessionRoomPage } from '@/features/agenda/pages/SessionRoomPage';
import { AvailabilityPage } from '@/features/availability/pages/AvailabilityPage';
import { AppLayout } from './layout/AppLayout';
import type { PageHandle } from './layout/pageHandle';
import { NAVIGATION } from './navigation';
import { ForbiddenPage } from './pages/ForbiddenPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SectionPage } from './pages/SectionPage';
import { UnexpectedErrorPage } from './pages/UnexpectedErrorPage';
import { PATHS, PSYCHOLOGIST_PATHS, ROLE_HOME_PATH } from './paths';
import { RootLayout } from './RootLayout';

/** Secciones del menú que ya tienen su pantalla; el resto muestra su estado vacío. */
const SECTION_PAGES: Partial<Record<string, ReactElement>> = {
  [PSYCHOLOGIST_PATHS.agenda]: <AgendaPage />,
  [PSYCHOLOGIST_PATHS.availability]: <AvailabilityPage />,
};

/** Pantallas de un rol que no están en el menú (se llega a ellas desde otra pantalla). */
const ROLE_ROUTES: Partial<Record<Role, RouteObject[]>> = {
  PSICOLOGO: [
    {
      path: PSYCHOLOGIST_PATHS.sessionRoom,
      handle: { title: 'Sala de sesión' } satisfies PageHandle,
      element: <SessionRoomPage />,
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
        ],
      })),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
