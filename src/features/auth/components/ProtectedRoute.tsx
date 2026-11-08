import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import type { LoginRedirectState } from '@/app/paths';
import { PATHS } from '@/app/paths';
import { LoadingStatus } from '@/shared/ui/LoadingStatus/LoadingStatus';
import { useAuth } from '../hooks/useAuth';
import type { Role } from '../model/session';

interface ProtectedRouteProps {
  role: Role;
  /** Qué mostrar cuando la sesión es de otro rol (aislamiento entre roles). */
  forbidden: ReactNode;
}

/** Deja pasar solo a una sesión activa del rol indicado; sin sesión, manda al login. */
export function ProtectedRoute({ role, forbidden }: Readonly<ProtectedRouteProps>) {
  const { session, restoring } = useAuth();
  const location = useLocation();

  if (session === null) {
    if (restoring) {
      // Al recargar, la sesión se recupera con la cookie de refresh.
      return <LoadingStatus fullScreen>Recuperando tu sesión…</LoadingStatus>;
    }
    const state: LoginRedirectState = { from: location.pathname };
    return <Navigate to={PATHS.login} replace state={state} />;
  }
  if (session.user.role !== role) {
    return <>{forbidden}</>;
  }
  return <Outlet />;
}
