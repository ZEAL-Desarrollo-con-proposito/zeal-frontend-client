import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/routes';
import { combineMockMessageHandlers, createMockRealtimeClient } from '@/mocks/realtime';
import { handleChatMessage } from '@/mocks/wellbeing/chatHandlers';
import { handleRoomMessage } from '@/mocks/wellbeing/roomHandlers';
import type { RealtimeClientFactory } from '@/shared/realtime/realtimeClient';
import { RealtimeFactoryContext } from '@/shared/realtime/RealtimeContext';

const onMockMessage = combineMockMessageHandlers(handleRoomMessage, handleChatMessage);

/** Renderiza la aplicación completa en una ruta inicial, con un router en memoria. */
export function renderRoute(
  initialPath: string,
  realtimeClientFactory: RealtimeClientFactory = (accessToken) =>
    createMockRealtimeClient(accessToken, onMockMessage),
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
