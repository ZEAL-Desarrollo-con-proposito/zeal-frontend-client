import { describe, expect, it } from 'vitest';
import type { GroupParticipant } from './groupCall';
import { participantLabel } from './groupCall';

const person: GroupParticipant = {
  id: 'usr-empleado-001',
  name: 'David Cajamarca',
  host: false,
  self: false,
  stream: null,
  media: { audio: true, video: true },
  speaking: false,
};

describe('participantLabel', () => {
  it('rotula a uno mismo como "Tú" y a la empresa como anfitriona', () => {
    expect(participantLabel(person)).toBe('David Cajamarca');
    expect(participantLabel({ ...person, self: true })).toBe('Tú');
    expect(participantLabel({ ...person, host: true, name: 'Talento Humano' })).toBe(
      'Talento Humano · Anfitrión',
    );
    expect(participantLabel({ ...person, host: true, self: true })).toBe('Tú · Anfitrión');
  });
});
