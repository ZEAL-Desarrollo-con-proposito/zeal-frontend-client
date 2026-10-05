import { describe, expect, it } from 'vitest';
import type { Application } from './application';
import {
  applicationBadge,
  applicationToast,
  byNewest,
  isApplication,
  isApplicationEvent,
} from './application';

const ACCEPTED: Application = {
  id: 'postulacion-1',
  projectId: 'proyecto-1',
  projectTitle: 'Mentoría inversa Gen Z',
  status: 'ACEPTADA',
  waitlistPosition: null,
  createdAt: new Date(2026, 8, 23, 9).toISOString(),
  version: 1,
};

const WAITING: Application = { ...ACCEPTED, status: 'EN_ESPERA', waitlistPosition: 2 };

describe('contrato de postulaciones', () => {
  it('acepta una postulación aceptada o en lista de espera', () => {
    expect(isApplication(ACCEPTED)).toBe(true);
    expect(isApplication(WAITING)).toBe(true);
  });

  it.each<[string, unknown]>([
    ['un valor que no es objeto', 'postulación'],
    ['un estado desconocido', { ...ACCEPTED, status: 'RECHAZADA' }],
    ['un puesto que no es positivo', { ...WAITING, waitlistPosition: 0 }],
    ['un puesto fraccionario', { ...WAITING, waitlistPosition: 1.5 }],
    ['una fecha inválida', { ...ACCEPTED, createdAt: 'hoy' }],
    ['sin versión entera', { ...ACCEPTED, version: '1' }],
    ['sin título de la convocatoria', { ...ACCEPTED, projectTitle: null }],
  ])('rechaza %s', (_case, value) => {
    expect(isApplication(value)).toBe(false);
  });

  it('valida el aviso de la cola privada', () => {
    expect(isApplicationEvent({ type: 'POSTULACION', application: ACCEPTED })).toBe(true);
    expect(isApplicationEvent({ type: 'POSTULACION', application: {} })).toBe(false);
    expect(isApplicationEvent({ type: 'OTRO', application: ACCEPTED })).toBe(false);
    expect(isApplicationEvent(null)).toBe(false);
  });
});

describe('resultado de la postulación', () => {
  it('muestra aceptada en salvia y la lista de espera en malva con el puesto', () => {
    expect(applicationBadge(ACCEPTED)).toEqual({ label: 'Aceptada', tone: 'sage' });
    expect(applicationBadge(WAITING)).toEqual({
      label: 'Lista de espera · puesto 2',
      tone: 'mauve',
    });
    expect(applicationBadge({ ...WAITING, waitlistPosition: null })).toEqual({
      label: 'Lista de espera',
      tone: 'mauve',
    });
  });

  it('informa el resultado con un aviso claro', () => {
    expect(applicationToast(ACCEPTED)).toEqual({
      tone: 'success',
      title: '¡Tienes un cupo en Mentoría inversa Gen Z!',
      message: 'Talento Humano te contactará para los siguientes pasos.',
    });
    expect(applicationToast(WAITING)).toEqual({
      tone: 'info',
      title: 'Quedaste en la lista de espera de Mentoría inversa Gen Z',
      message:
        'Otra persona tomó el último cupo un instante antes. Ocupas el puesto 2. Si se libera uno, te avisamos.',
    });
    expect(applicationToast({ ...WAITING, waitlistPosition: null }).message).toBe(
      'Otra persona tomó el último cupo un instante antes. Si se libera uno, te avisamos.',
    );
  });

  it('ordena las más recientes primero', () => {
    const older = { ...ACCEPTED, createdAt: new Date(2026, 8, 22).toISOString() };
    expect([older, ACCEPTED].sort(byNewest)).toEqual([ACCEPTED, older]);
  });
});
