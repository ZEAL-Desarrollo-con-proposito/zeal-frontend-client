import { describe, expect, it } from 'vitest';
import { isEmailFormat, validateCredentials } from './useLoginForm';

describe('isEmailFormat', () => {
  it.each(['nombre@empresa.com', 'david.cajamarca@nexura.co', 'a@b.co'])('acepta %s', (email) => {
    expect(isEmailFormat(email)).toBe(true);
  });

  it.each([
    ['sin arroba', 'nombre.empresa.com'],
    ['sin texto antes de la arroba', '@empresa.com'],
    ['con dos arrobas', 'nombre@@empresa.com'],
    ['sin punto en el dominio', 'nombre@empresa'],
    ['con el punto pegado a la arroba', 'nombre@.com'],
    ['terminado en punto', 'nombre@empresa.'],
    ['con espacios', 'nombre apellido@empresa.com'],
  ])('rechaza un correo %s', (_case, email) => {
    expect(isEmailFormat(email)).toBe(false);
  });
});

describe('validateCredentials', () => {
  it('no reporta errores con un correo válido y una contraseña', () => {
    expect(validateCredentials({ email: ' nombre@empresa.com ', password: 'x' })).toEqual({});
  });
});
