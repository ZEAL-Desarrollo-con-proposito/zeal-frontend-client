import { delay, http, HttpResponse } from 'msw';
import { LOGIN_ENDPOINT } from '@/features/auth/api/authApi';
import { createMockToken, MOCK_TOKEN_TTL_SECONDS } from './mockToken';
import { findSeedUser } from './seedUsers';

interface LoginRequestBody {
  email?: unknown;
  password?: unknown;
}

function errorBody(status: number, error: string, message: string) {
  return HttpResponse.json({ status, error, message }, { status });
}

export const handlers = [
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
