import { delay, http, HttpResponse } from 'msw';
import { LOGIN_ENDPOINT } from '@/features/auth/api/authApi';
import { errorBody } from './mockAuth';
import { createMockToken, MOCK_TOKEN_TTL_SECONDS } from './mockToken';
import { notificationHandlers } from './notifications/handlers';
import { presenceHandlers } from './presenceHandlers';
import { adminProjectHandlers } from './projects/adminHandlers';
import { applicationHandlers } from './projects/applicationHandlers';
import { projectHandlers } from './projects/handlers';
import { findSeedUser } from './seedUsers';
import { bookingHandlers } from './wellbeing/bookingHandlers';
import { chatHistoryHandlers } from './wellbeing/chatHistoryHandlers';
import { directoryHandlers } from './wellbeing/directoryHandlers';
import { freedSlotHandlers } from './wellbeing/freedSlotHandlers';
import { wellbeingHandlers } from './wellbeing/handlers';
import { roomHandlers } from './wellbeing/roomHandlers';
import { workshopHandlers } from './workshops/handlers';

interface LoginRequestBody {
  email?: unknown;
  password?: unknown;
}

const authHandlers = [
  http.post<never, LoginRequestBody>(`*${LOGIN_ENDPOINT}`, async ({ request }) => {
    await delay();
    const { email, password } = await request.json();

    if (typeof email !== 'string' || typeof password !== 'string') {
      return errorBody(400, 'Bad Request', 'El correo y la contraseña son obligatorios');
    }

    const user = findSeedUser(email, password);
    if (user === undefined) {
      return errorBody(401, 'Unauthorized', 'Correo o contraseña incorrectos');
    }

    return HttpResponse.json({
      accessToken: createMockToken(user),
      tokenType: 'Bearer',
      expiresIn: MOCK_TOKEN_TTL_SECONDS,
      user,
    });
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
  ...workshopHandlers,
];
