import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/shared/api/errors';
import { describeMutationError, MUTATION_ERROR_MESSAGES } from '@/shared/api/describeError';
import { describeSlot } from './slot';
import {
  draftToNewSlot,
  END_TIME_OPTIONS,
  START_TIME_OPTIONS,
  toMinutes,
  validateDraft,
} from './slotDraft';
import { INITIAL_SLOTS_STATE, slotsReducer } from './slotsState';

describe('borrador de franja', () => {
  it('ofrece horas cada 15 minutos dentro de la jornada', () => {
    expect(START_TIME_OPTIONS.at(0)).toEqual({ value: '07:00', label: '7:00' });
    expect(START_TIME_OPTIONS.at(-1)).toEqual({ value: '18:45', label: '18:45' });
    expect(END_TIME_OPTIONS.at(0)).toEqual({ value: '07:15', label: '7:15' });
    expect(END_TIME_OPTIONS.at(-1)).toEqual({ value: '19:00', label: '19:00' });
  });

  it('solo valida la coherencia de las horas', () => {
    expect(validateDraft({ day: '2026-09-23', start: '10:00', end: '10:45' })).toEqual({});
    expect(validateDraft({ day: '2026-09-23', start: '10:00', end: '10:00' }).end).toBeDefined();
    expect(toMinutes('09:30')).toBe(570);
  });

  it('convierte la hora local al contrato ISO del API', () => {
    expect(draftToNewSlot({ day: '2026-09-23', start: '10:00', end: '10:50' })).toEqual({
      startsAt: new Date(2026, 8, 23, 10, 0).toISOString(),
      endsAt: new Date(2026, 8, 23, 10, 50).toISOString(),
    });
    expect(
      describeSlot({
        startsAt: new Date(2026, 8, 23, 10).toISOString(),
        endsAt: new Date(2026, 8, 23, 10, 50).toISOString(),
      }),
    ).toBe('miércoles, 23 de septiembre de 10:00 a 10:50');
  });

  it('aplicar dos veces la misma franja creada no la duplica', () => {
    const slot = {
      id: 'franja-1',
      psychologistId: 'psi',
      startsAt: '2026-09-23T15:00:00.000Z',
      endsAt: '2026-09-23T16:00:00.000Z',
      status: 'DISPONIBLE' as const,
    };
    const once = slotsReducer(INITIAL_SLOTS_STATE, { type: 'created', slot });

    expect(slotsReducer(once, { type: 'created', slot }).slots).toEqual([slot]);
  });
});

describe('describeMutationError', () => {
  it.each([
    ['un rechazo explicado por el servidor', new ApiError(409, 'Cruce'), 'Cruce'],
    ['un rechazo sin explicación', new ApiError(409), MUTATION_ERROR_MESSAGES.generic],
    [
      'un error interno',
      new ApiError(500, 'NullPointerException'),
      MUTATION_ERROR_MESSAGES.generic,
    ],
    ['la falta de conexión', new NetworkError(), MUTATION_ERROR_MESSAGES.network],
    ['un error desconocido', new Error('x'), MUTATION_ERROR_MESSAGES.generic],
  ])('traduce %s', (_case, error, expected) => {
    expect(describeMutationError(error)).toBe(expected);
  });
});
