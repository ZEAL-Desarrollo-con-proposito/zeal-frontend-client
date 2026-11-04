import { createContext } from 'react';
import type { Session } from '../model/session';

export interface AuthContextValue {
  session: Session | null;
  /** Sin sesión en memoria, todavía se está comprobando si la cookie de refresh sigue vigente. */
  restoring: boolean;
  /** La última sesión terminó por vencimiento o rechazo del servidor, no por decisión del usuario. */
  sessionExpired: boolean;
  signIn: (session: Session) => void;
  signOut: () => void;
  /** Pide un token nuevo y devuelve `null` si no se pudo; si el servidor la rechaza, la sesión termina. */
  renew: () => Promise<string | null>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
