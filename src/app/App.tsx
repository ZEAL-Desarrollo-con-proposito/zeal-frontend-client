import { MotionConfig } from 'motion/react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import type { RealtimeClientFactory } from '@/shared/realtime/realtimeClient';
import { RealtimeFactoryContext } from '@/shared/realtime/RealtimeContext';
import { routes } from './routes';

const router = createBrowserRouter(routes);

interface AppProps {
  /** Adaptador de tiempo real elegido al arrancar: Real-Time Gateway o simulador de desarrollo. */
  realtimeClientFactory: RealtimeClientFactory;
}

export function App({ realtimeClientFactory }: Readonly<AppProps>) {
  return (
    // "user": respeta la preferencia del sistema operativo de reducir el movimiento.
    <MotionConfig reducedMotion="user">
      <RealtimeFactoryContext value={realtimeClientFactory}>
        <RouterProvider router={router} />
      </RealtimeFactoryContext>
    </MotionConfig>
  );
}
