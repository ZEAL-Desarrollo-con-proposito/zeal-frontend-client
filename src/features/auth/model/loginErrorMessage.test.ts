import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/shared/api/errors';
import { describeLoginError, describeReturnError, LOGIN_ERROR_MESSAGES } from './loginErrorMessage';

describe('describeLoginError', () => {
  it.each([
    ['500', new ApiError(500, 'NullPointerException'), LOGIN_ERROR_MESSAGES.serviceUnavailable],
    [
      '400 con mensaje del servidor',
      new ApiError(400, 'Ruta inválida'),
      LOGIN_ERROR_MESSAGES.generic,
    ],
    ['sin red', new NetworkError(), LOGIN_ERROR_MESSAGES.network],
    ['desconocido', new Error('x'), LOGIN_ERROR_MESSAGES.generic],
  ])('traduce un error %s sin mostrar detalles del servidor', (_case, error, expected) => {
    expect(describeLoginError(error)).toBe(expected);
  });
});

describe('describeReturnError', () => {
  it('sin error al volver de Microsoft no muestra nada', () => {
    expect(describeReturnError(null)).toBeNull();
  });

  it.each([
    ['cuenta_no_registrada', /no tiene acceso a ZEAL/],
    ['cancelado', /Cancelaste el inicio de sesión/],
  ])('explica %s sin revelar qué cuentas existen', (code, expected) => {
    expect(describeReturnError(code)).toMatch(expected);
  });

  it.each(['fallo', '<script>alert(1)</script>', 'toString'])(
    'un código desconocido (%s) no se pinta tal cual',
    (code) => {
      expect(describeReturnError(code)).toBe(LOGIN_ERROR_MESSAGES.generic);
    },
  );
});
