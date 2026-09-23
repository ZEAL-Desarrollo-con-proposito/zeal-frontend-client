import { MotionConfig } from 'motion/react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { routes } from './routes';

const router = createBrowserRouter(routes);

export function App() {
  return (
    // "user": respeta la preferencia del sistema operativo de reducir el movimiento.
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
  );
}
