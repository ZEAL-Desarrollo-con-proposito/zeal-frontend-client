import { use } from 'react';
import { AuthContext } from '../context/AuthContext';
import type { AuthUser } from '../model/session';

export function useAuth() {
  const context = use(AuthContext);
  if (context === null) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return context;
}

/** Usuario autenticado. Solo para vistas que se renderizan con una sesión activa. */
export function useCurrentUser(): AuthUser {
  const { session } = useAuth();
  if (session === null) {
    throw new Error('No hay una sesión activa');
  }
  return session.user;
}
