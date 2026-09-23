import type { RouteObject } from 'react-router';
import { Navigate } from 'react-router';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PATHS } from './paths';

export const routes: RouteObject[] = [
  { path: PATHS.root, element: <Navigate to={PATHS.login} replace /> },
  { path: PATHS.login, element: <LoginPage /> },
  { path: '*', element: <NotFoundPage /> },
];
