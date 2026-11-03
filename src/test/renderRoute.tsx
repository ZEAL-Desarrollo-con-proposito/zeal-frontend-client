import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/routes';
import { combineMockMessageHandlers, createMockRealtimeClient } from '@/mocks/realtime';
import { handleChatMessage } from '@/mocks/wellbeing/chatHandlers';
import { handleRoomMessage } from '@/mocks/wellbeing/roomHandlers';
import type { RealtimeClientFactory } from '@/shared/realtime/realtimeClient';
import { RealtimeFactoryContext } from '@/shared/realtime/RealtimeContext';
import { trackSubscriptions } from './realtime';
import { setupUser } from './user';

const onMockMessage = combineMockMessageHandlers(handleRoomMessage, handleChatMessage);

/**
 * Renderiza la aplicación completa en una ruta inicial, con un router en memoria. `subscribedTo`
 * espera a que la pantalla escuche un destino antes de que la prueba publique en él.
 */
export function renderRoute(
  initialPath: string,
  realtimeClientFactory: RealtimeClientFactory = (accessToken) =>
    createMockRealtimeClient(accessToken, onMockMessage),
) {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  const user = setupUser();
  const { factory, subscribedTo } = trackSubscriptions(realtimeClientFactory);
  const { unmount } = render(
    <RealtimeFactoryContext value={factory}>
      <RouterProvider router={router} />
    </RealtimeFactoryContext>,
  );
  return { router, user, unmount, subscribedTo };
}
