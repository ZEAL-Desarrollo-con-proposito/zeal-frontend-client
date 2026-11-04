import type { ReactNode } from 'react';
import { use, useEffect, useMemo } from 'react';
import type { RealtimeCredentials } from './realtimeClient';
import { RealtimeContext, RealtimeFactoryContext } from './RealtimeContext';

interface RealtimeProviderProps {
  /** Token con el que se abre la conexión; sin sesión no hay conexión. */
  accessToken: string | null;
  /** Cómo seguir al día con la sesión mientras la conexión está abierta. */
  credentials?: RealtimeCredentials;
  children: ReactNode;
}

/** Abre una conexión de tiempo real por sesión y la cierra al cerrar sesión o cambiar de token. */
export function RealtimeProvider({
  accessToken,
  credentials,
  children,
}: Readonly<RealtimeProviderProps>) {
  const createClient = use(RealtimeFactoryContext);
  const client = useMemo(
    () =>
      accessToken === null || createClient === null ? null : createClient(accessToken, credentials),
    [accessToken, credentials, createClient],
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
