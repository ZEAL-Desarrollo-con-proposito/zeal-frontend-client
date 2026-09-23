import { createContext } from 'react';
import type { Session } from '../model/session';

export interface AuthContextValue {
  session: Session | null;
  signIn: (session: Session) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
