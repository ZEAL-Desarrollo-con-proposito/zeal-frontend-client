import { Outlet } from 'react-router';
import { AuthProvider } from '@/features/auth/context/AuthProvider';

/** Raíz de la aplicación: la sesión envuelve todas las rutas. */
export function RootLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}
