import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/shared/api/errors';
import { describeLoginError, LOGIN_ERROR_MESSAGES } from './loginErrorMessage';
import { LOGIN_LOCKOUT_MESSAGE } from './loginLockout';

describe('describeLoginError', () => {
  it.each([
    ['401 con mensaje del servidor', new ApiError(401, 'Cuenta bloqueada'), 'Cuenta bloqueada'],
    ['401 sin mensaje', new ApiError(401), LOGIN_ERROR_MESSAGES.invalidCredentials],
    ['500', new ApiError(500, 'NullPointerException'), LOGIN_ERROR_MESSAGES.serviceUnavailable],
    ['400 con mensaje del servidor', new ApiError(400, 'Correo inválido'), 'Correo inválido'],
    ['400 sin mensaje', new ApiError(400), LOGIN_ERROR_MESSAGES.generic],
    ['429', new ApiError(429), LOGIN_LOCKOUT_MESSAGE],
    ['403 con Retry-After', new ApiError(403, 'Cuenta bloqueada', 30), LOGIN_LOCKOUT_MESSAGE],
    ['403 sin Retry-After', new ApiError(403), LOGIN_LOCKOUT_MESSAGE],
    ['sin red', new NetworkError(), LOGIN_ERROR_MESSAGES.network],
    ['desconocido', new Error('x'), LOGIN_ERROR_MESSAGES.generic],
  ])('traduce un error %s', (_case, error, expected) => {
    expect(describeLoginError(error)).toBe(expected);
  });
});
