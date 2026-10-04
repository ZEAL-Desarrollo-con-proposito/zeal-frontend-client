import { describe, expect, it } from 'vitest';
import type { ChatMessage } from './chatMessage';
import { chatDayLabel, groupChatMessagesByDay } from './chatMessageGroups';

/** Miércoles 23 de septiembre de 2026, 9:20 a. m. */
const NOW = new Date(2026, 8, 23, 9, 20).getTime();

function mensaje(id: string, sentAt: Date): ChatMessage {
  return {
    id,
    conversationId: 'usr-empleado-001:usr-psicologo-001',
    senderId: 'usr-empleado-001',
    senderName: 'David Cajamarca',
    text: `Mensaje ${id}`,
    sentAt: sentAt.toISOString(),
  };
}

describe('chatDayLabel', () => {
  it('ubica el día como en cualquier chat', () => {
    expect(chatDayLabel(new Date(2026, 8, 23, 8, 5), NOW)).toBe('Hoy');
    expect(chatDayLabel(new Date(2026, 8, 22, 18, 40), NOW)).toBe('Ayer');
    expect(chatDayLabel(new Date(2026, 8, 18, 10), NOW)).toBe('Viernes, 18 de septiembre');
  });
});

describe('groupChatMessagesByDay', () => {
  it('agrupa en el orden recibido y respeta el día de cada mensaje', () => {
    const groups = groupChatMessagesByDay(
      [
        mensaje('m1', new Date(2026, 8, 23, 9)),
        mensaje('m2', new Date(2026, 8, 23, 9, 30)),
        mensaje('m3', new Date(2026, 8, 22, 18)),
      ],
      NOW,
    );

    expect(
      groups.map(({ key, label, messages }) => [key, label, messages.map(({ id }) => id)]),
    ).toEqual([
      ['2026-09-23', 'Hoy', ['m1', 'm2']],
      ['2026-09-22', 'Ayer', ['m3']],
    ]);
  });

  it('sin mensajes no inventa grupos', () => {
    expect(groupChatMessagesByDay([], NOW)).toEqual([]);
  });
});
