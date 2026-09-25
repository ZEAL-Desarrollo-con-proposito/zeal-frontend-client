import type { ReactNode } from 'react';
import { Outlet } from 'react-router';
import { AuthProvider } from '@/features/auth/context/AuthProvider';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { RealtimeProvider } from '@/shared/realtime/RealtimeProvider';

/** Raíz de la aplicación: la sesión y su conexión en tiempo real envuelven todas las rutas. */
export function RootLayout() {
  return (
    <AuthProvider>
      <SessionRealtime>
        <Outlet />
      </SessionRealtime>
    </AuthProvider>
  );
}

/** Una conexión en tiempo real por sesión: se abre al iniciar sesión y se cierra al salir. */
function SessionRealtime({ children }: Readonly<{ children: ReactNode }>) {
  const { session } = useAuth();
  return (
    <RealtimeProvider accessToken={session === null ? null : session.accessToken}>
      {children}
    </RealtimeProvider>
  );
}
