import { describe, expect, it } from 'vitest';
import { resolvePostLoginPath, ROLE_HOME_PATH } from './paths';

describe('resolvePostLoginPath', () => {
  it('vuelve a la ruta pedida antes del login si pertenece al rol', () => {
    expect(resolvePostLoginPath('PSICOLOGO', { from: '/psicologo/pacientes' })).toBe(
      '/psicologo/pacientes',
    );
  });

  it.each([
    ['de otro rol', { from: '/admin/panel' }],
    ['que solo comparte el prefijo', { from: '/psicologo-falso/x' }],
    ['externa', { from: 'https://sitio-malicioso.com/psicologo/' }],
    ['con un tipo inválido', { from: 42 }],
    ['sin estado', null],
  ])('ignora una ruta %s y usa la pantalla de llegada', (_case, state) => {
    expect(resolvePostLoginPath('PSICOLOGO', state)).toBe(ROLE_HOME_PATH.PSICOLOGO);
  });
});
