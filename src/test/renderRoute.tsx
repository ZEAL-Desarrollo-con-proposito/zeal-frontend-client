import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/routes';
import { createMockRealtimeClient } from '@/mocks/realtime';
import type { RealtimeClientFactory } from '@/shared/realtime/realtimeClient';
import { RealtimeFactoryContext } from '@/shared/realtime/RealtimeContext';

/** Renderiza la aplicación completa en una ruta inicial, con un router en memoria. */
export function renderRoute(
  initialPath: string,
  realtimeClientFactory: RealtimeClientFactory = () => createMockRealtimeClient(),
) {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  const user = userEvent.setup();
  const { unmount } = render(
    <RealtimeFactoryContext value={realtimeClientFactory}>
      <RouterProvider router={router} />
    </RealtimeFactoryContext>,
  );
  return { router, user, unmount };
}
