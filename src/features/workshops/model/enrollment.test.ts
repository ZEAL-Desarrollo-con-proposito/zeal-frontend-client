import { describe, expect, it } from 'vitest';
import type { Enrollment } from './enrollment';
import { enrollmentToast, isEnrollment, isEnrollmentEvent } from './enrollment';

const ENROLLMENT: Enrollment = {
  id: 'inscripcion-1',
  workshopId: 'taller-impostor',
  workshopTitle: 'Síndrome del impostor en tu primer empleo',
  facilitator: 'Andrés Rojas',
  startsAt: new Date(2026, 8, 24, 12, 30).toISOString(),
  endsAt: new Date(2026, 8, 24, 13, 30).toISOString(),
  createdAt: new Date(2026, 8, 23, 9, 20).toISOString(),
  version: 1,
};

describe('inscripción', () => {
  it('reconoce la inscripción y su aviso, y descarta lo incompleto', () => {
    expect(isEnrollment(ENROLLMENT)).toBe(true);
    expect(isEnrollment({ ...ENROLLMENT, version: 1.5 })).toBe(false);
    expect(isEnrollment({ ...ENROLLMENT, createdAt: 'ayer' })).toBe(false);
    expect(isEnrollmentEvent({ type: 'INSCRIPCION', enrollment: ENROLLMENT })).toBe(true);
    expect(isEnrollmentEvent({ type: 'POSTULACION', enrollment: ENROLLMENT })).toBe(false);
    expect(isEnrollmentEvent({ type: 'INSCRIPCION', enrollment: {} })).toBe(false);
  });

  it('confirma el cupo con cuándo es y dónde encontrarlo', () => {
    expect(enrollmentToast(ENROLLMENT, new Date(2026, 8, 23, 9, 20).getTime())).toEqual({
      tone: 'success',
      title: '¡Tienes tu cupo en Síndrome del impostor en tu primer empleo!',
      message: 'Mañana · 12:30 con Andrés Rojas. Lo encuentras en Mis talleres.',
    });
  });
});
