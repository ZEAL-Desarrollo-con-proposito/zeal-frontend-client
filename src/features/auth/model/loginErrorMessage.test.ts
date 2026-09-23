import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/shared/api/errors';
import { describeLoginError, LOGIN_ERROR_MESSAGES } from './loginErrorMessage';

describe('describeLoginError', () => {
  it.each([
    ['401 con mensaje del servidor', new ApiError(401, 'Cuenta bloqueada'), 'Cuenta bloqueada'],
    ['401 sin mensaje', new ApiError(401), LOGIN_ERROR_MESSAGES.invalidCredentials],
    ['500', new ApiError(500, 'NullPointerException'), LOGIN_ERROR_MESSAGES.serviceUnavailable],
    ['400 con mensaje del servidor', new ApiError(400, 'Correo inválido'), 'Correo inválido'],
    ['429 sin mensaje', new ApiError(429), LOGIN_ERROR_MESSAGES.generic],
    ['sin red', new NetworkError(), LOGIN_ERROR_MESSAGES.network],
    ['desconocido', new Error('x'), LOGIN_ERROR_MESSAGES.generic],
  ])('traduce un error %s', (_case, error, expected) => {
    expect(describeLoginError(error)).toBe(expected);
  });
});
