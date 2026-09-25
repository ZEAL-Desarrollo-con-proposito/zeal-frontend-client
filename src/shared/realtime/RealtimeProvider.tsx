import type { ReactNode } from 'react';
import { use, useEffect, useMemo } from 'react';
import { RealtimeContext, RealtimeFactoryContext } from './RealtimeContext';

interface RealtimeProviderProps {
  /** Token de la sesión; sin sesión no hay conexión. */
  accessToken: string | null;
  children: ReactNode;
}

/** Abre una conexión de tiempo real por sesión y la cierra al cerrar sesión o cambiar de token. */
export function RealtimeProvider({ accessToken, children }: Readonly<RealtimeProviderProps>) {
  const createClient = use(RealtimeFactoryContext);
  const client = useMemo(
    () => (accessToken === null || createClient === null ? null : createClient(accessToken)),
    [accessToken, createClient],
  );

  useEffect(() => {
    if (client === null) {
      return undefined;
    }
    client.connect();
    return () => {
      client.disconnect();
    };
  }, [client]);

  return <RealtimeContext value={client}>{children}</RealtimeContext>;
}
