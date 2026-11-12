import { MotionConfig } from 'motion/react';
import { useState } from 'react';
import type { RouteObject } from 'react-router';
import { createBrowserRouter, RouterProvider } from 'react-router';
import type { RealtimeClientFactory } from '@/shared/realtime/realtimeClient';
import { RealtimeFactoryContext } from '@/shared/realtime/RealtimeContext';
import { routes } from './routes';

interface AppProps {
  /** Adaptador de tiempo real elegido al arrancar: Real-Time Gateway o simulador de desarrollo. */
  realtimeClientFactory: RealtimeClientFactory;
  /** Pantallas que solo existen con el simulador (p. ej. el selector de cuentas de Microsoft). */
  extraRoutes: readonly RouteObject[];
}

export function App({ realtimeClientFactory, extraRoutes }: Readonly<AppProps>) {
  const [router] = useState(() => createBrowserRouter([...extraRoutes, ...routes]));
  return (
    // "user": respeta la preferencia del sistema operativo de reducir el movimiento.
    <MotionConfig reducedMotion="user">
      <RealtimeFactoryContext value={realtimeClientFactory}>
        <RouterProvider router={router} />
      </RealtimeFactoryContext>
    </MotionConfig>
  );
}
