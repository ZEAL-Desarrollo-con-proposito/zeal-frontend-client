import { delay, http, HttpResponse } from 'msw';
import { LOGOUT_ENDPOINT, REFRESH_ENDPOINT } from '@/features/auth/api/authApi';
import type { AuthUser } from '@/features/auth/model/session';
import { microsoftLoginHandlers } from './microsoft/handlers';
import { errorBody } from './mockAuth';
import { createMockToken, MOCK_TOKEN_TTL_SECONDS } from './mockToken';
import { notificationHandlers } from './notifications/handlers';
import { presenceHandlers } from './presenceHandlers';
import { adminProjectHandlers } from './projects/adminHandlers';
import { applicationHandlers } from './projects/applicationHandlers';
import { projectHandlers } from './projects/handlers';
import { readRefreshCookie, revokeRefreshFamily, rotateRefreshCookie } from './refreshSession';
import { SEED_USERS } from './seedUsers';
import { telemetryHandlers } from './telemetryHandlers';
import { adminWorkshopHandlers } from './workshops/adminHandlers';
import { bookingHandlers } from './wellbeing/bookingHandlers';
import { chatHistoryHandlers } from './wellbeing/chatHistoryHandlers';
import { directoryHandlers } from './wellbeing/directoryHandlers';
import { freedSlotHandlers } from './wellbeing/freedSlotHandlers';
import { wellbeingHandlers } from './wellbeing/handlers';
import { roomHandlers } from './wellbeing/roomHandlers';
import { workshopHandlers } from './workshops/handlers';
import { workshopRoomHandlers } from './workshops/roomHandlers';
import { organizationHandlers } from './organizationHandlers';

function sessionResponse(user: AuthUser) {
  return HttpResponse.json({
    accessToken: createMockToken(user),
    tokenType: 'Bearer',
    expiresIn: MOCK_TOKEN_TTL_SECONDS,
    user,
  });
}

const authHandlers = [
  ...microsoftLoginHandlers,

  http.post(`*${REFRESH_ENDPOINT}`, async () => {
    const cookie = readRefreshCookie();
    await delay();
    const userId = rotateRefreshCookie(cookie);
    const user = SEED_USERS.find(({ id }) => id === userId);
    return user === undefined
      ? errorBody(401, 'Unauthorized', 'Tu sesión venció. Vuelve a iniciar sesión.')
      : sessionResponse(user);
  }),

  http.post(`*${LOGOUT_ENDPOINT}`, async () => {
    const cookie = readRefreshCookie();
    await delay();
    revokeRefreshFamily(cookie);
    return new HttpResponse(null, { status: 204 });
  }),
];

export const handlers = [
  ...authHandlers,
  ...bookingHandlers,
  ...freedSlotHandlers,
  ...roomHandlers,
  ...wellbeingHandlers,
  ...directoryHandlers,
  ...notificationHandlers,
  ...chatHistoryHandlers,
  ...presenceHandlers,
  ...applicationHandlers,
  ...projectHandlers,
  ...adminProjectHandlers,
  ...adminWorkshopHandlers,
  ...organizationHandlers,
  ...workshopRoomHandlers,
  ...workshopHandlers,
  ...telemetryHandlers,
];
