import type { RouteObject } from 'react-router';
import { Navigate } from 'react-router';
import { ROLES } from '@/features/auth/model/session';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { UnexpectedErrorPage } from './pages/UnexpectedErrorPage';
import { PATHS, ROLE_HOME_PATH } from './paths';
import { RootLayout } from './RootLayout';

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <UnexpectedErrorPage />,
    children: [
      { path: PATHS.root, element: <Navigate to={PATHS.login} replace /> },
      { path: PATHS.login, element: <LoginPage /> },
      ...ROLES.map((role) => ({ path: ROLE_HOME_PATH[role], element: <HomePage /> })),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
