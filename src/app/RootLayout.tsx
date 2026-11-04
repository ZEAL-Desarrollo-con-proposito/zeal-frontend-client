import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Outlet } from 'react-router';
import { AuthProvider } from '@/features/auth/context/AuthProvider';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { sessionStore } from '@/features/auth/storage/sessionStore';
import { RealtimeProvider } from '@/shared/realtime/RealtimeProvider';
import { ToastProvider } from '@/shared/ui/Toast/ToastProvider';

/**
 * Raíz de la aplicación: la sesión, su conexión en tiempo real y los avisos emergentes envuelven
 * todas las rutas.
 */
export function RootLayout() {
  return (
    <AuthProvider>
      <ToastProvider>
        <SessionRealtime>
          <Outlet />
        </SessionRealtime>
      </ToastProvider>
    </AuthProvider>
  );
}

/**
 * Una conexión en tiempo real por persona: se abre al iniciar sesión y se cierra al salir. Renovar
 * el token no la interrumpe (una llamada o un chat en curso siguen); lo usará al reconectarse.
 */
function SessionRealtime({ children }: Readonly<{ children: ReactNode }>) {
  const { session, renew } = useAuth();
  const userId = session === null ? null : session.user.id;
  const [connection, setConnection] = useState({
    userId,
    accessToken: session === null ? null : session.accessToken,
  });
  if (connection.userId !== userId) {
    setConnection({ userId, accessToken: session === null ? null : session.accessToken });
  }
  const credentials = useMemo(
    () => ({
      currentToken: sessionStore.accessToken,
      onRejected: () => {
        void renew();
      },
    }),
    [renew],
  );

  return (
    <RealtimeProvider accessToken={connection.accessToken} credentials={credentials}>
      {children}
    </RealtimeProvider>
  );
}
