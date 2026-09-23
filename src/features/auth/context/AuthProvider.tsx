import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import type { Session } from '../model/session';
import { AuthContext } from './AuthContext';

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [session, setSession] = useState<Session | null>(null);

  const value = useMemo(() => ({ session, signIn: setSession }), [session]);

  return <AuthContext value={value}>{children}</AuthContext>;
}
