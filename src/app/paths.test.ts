import { describe, expect, it } from 'vitest';
import {
  directoryReturnPath,
  EMPLOYEE_PATHS,
  psychologistPath,
  resolvePostLoginPath,
  ROLE_HOME_PATH,
} from './paths';

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

describe('directoryReturnPath', () => {
  it('vuelve al directorio con los filtros que tenía', () => {
    expect(directoryReturnPath({ directorySearch: '?tema=Duelo&hoy=1' })).toBe(
      '/empleado/bienestar?tema=Duelo&hoy=1',
    );
  });

  it.each([
    ['sin estado', null],
    ['sin filtros', { directorySearch: '' }],
    ['con algo que no es una búsqueda', { directorySearch: '/admin/panel' }],
    ['con un tipo inválido', { directorySearch: 7 }],
  ])('vuelve al directorio limpio %s', (_case, state) => {
    expect(directoryReturnPath(state)).toBe(EMPLOYEE_PATHS.wellbeing);
  });
});

describe('psychologistPath', () => {
  it('codifica el id en la ruta del perfil', () => {
    expect(psychologistPath('usr psicologo/1')).toBe(
      '/empleado/bienestar/psicologos/usr%20psicologo%2F1',
    );
  });
});
