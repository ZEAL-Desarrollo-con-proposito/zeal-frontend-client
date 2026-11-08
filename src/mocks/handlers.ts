import { delay, http, HttpResponse } from 'msw';
import { LOGIN_ENDPOINT, LOGOUT_ENDPOINT, REFRESH_ENDPOINT } from '@/features/auth/api/authApi';
import type { AuthUser } from '@/features/auth/model/session';
import { errorBody } from './mockAuth';
import { createMockToken, MOCK_TOKEN_TTL_SECONDS } from './mockToken';
import { notificationHandlers } from './notifications/handlers';
import { presenceHandlers } from './presenceHandlers';
import { adminProjectHandlers } from './projects/adminHandlers';
import { applicationHandlers } from './projects/applicationHandlers';
import { projectHandlers } from './projects/handlers';
import { revokeRefreshFamily, rotateRefreshCookie, startRefreshFamily } from './refreshSession';
import { findSeedUser, SEED_USERS } from './seedUsers';
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

interface LoginRequestBody {
  email?: unknown;
  password?: unknown;
  remember?: unknown;
}

function sessionResponse(user: AuthUser) {
  return HttpResponse.json({
    accessToken: createMockToken(user),
    tokenType: 'Bearer',
    expiresIn: MOCK_TOKEN_TTL_SECONDS,
    user,
  });
}

const authHandlers = [
  http.post<never, LoginRequestBody>(`*${LOGIN_ENDPOINT}`, async ({ request }) => {
    await delay();
    const { email, password, remember } = await request.json();

    if (typeof email !== 'string' || typeof password !== 'string') {
      return errorBody(400, 'Bad Request', 'El correo y la contraseña son obligatorios');
    }

    const user = findSeedUser(email, password);
    if (user === undefined) {
      return errorBody(401, 'Unauthorized', 'Correo o contraseña incorrectos');
    }

    startRefreshFamily(user.id, remember === true);
    return sessionResponse(user);
  }),

  http.post(`*${REFRESH_ENDPOINT}`, async () => {
    await delay();
    const userId = rotateRefreshCookie();
    const user = SEED_USERS.find(({ id }) => id === userId);
    return user === undefined
      ? errorBody(401, 'Unauthorized', 'Tu sesión venció. Vuelve a iniciar sesión.')
      : sessionResponse(user);
  }),

  http.post(`*${LOGOUT_ENDPOINT}`, async () => {
    await delay();
    revokeRefreshFamily();
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
