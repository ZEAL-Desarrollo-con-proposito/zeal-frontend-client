import { createContext } from 'react';
import type { Session } from '../model/session';

export interface AuthContextValue {
  session: Session | null;
  /** La última sesión terminó por vencimiento o rechazo del servidor, no por decisión del usuario. */
  sessionExpired: boolean;
  signIn: (session: Session, remember: boolean) => void;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
