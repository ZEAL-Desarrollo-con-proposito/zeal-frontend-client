import { describe, expect, it } from 'vitest';
import type { ChatMessage } from './chatMessage';
import {
  conversationId,
  isChatMessage,
  mergeChatMessages,
  parseConversationId,
} from './chatMessage';

const EMPLOYEE_ID = 'usr-empleado-001';
const PSYCHOLOGIST_ID = 'usr-psicologo-001';

function mensaje(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'mensaje-1',
    conversationId: conversationId(EMPLOYEE_ID, PSYCHOLOGIST_ID),
    senderId: EMPLOYEE_ID,
    senderName: 'David Cajamarca',
    text: '¿Cómo amaneciste?',
    sentAt: new Date(2026, 8, 23, 9, 15).toISOString(),
    ...overrides,
  };
}

/** El mismo mensaje con los campos que el servidor pudo mandar mal. */
function con(valores: Record<string, unknown>): unknown {
  return { ...mensaje(), ...valores };
}

describe('isChatMessage', () => {
  it('acepta un mensaje completo', () => {
    expect(isChatMessage(mensaje())).toBe(true);
  });

  it.each<[string, unknown]>([
    ['no es un objeto', 'mensaje-1'],
    ['es null', null],
    ['no tiene id', con({ id: undefined })],
    ['no tiene conversación', con({ conversationId: undefined })],
    ['no tiene remitente', con({ senderId: undefined })],
    ['no tiene el nombre del remitente', con({ senderName: undefined })],
    ['no tiene texto', con({ text: undefined })],
    ['el texto está en blanco', con({ text: '   ' })],
    ['la hora no es una fecha', con({ sentAt: 'ayer' })],
    ['la hora no es texto', con({ sentAt: 1_756_000_000_000 })],
  ])('rechaza %s', (_caso, valor) => {
    expect(isChatMessage(valor)).toBe(false);
  });
});

describe('conversationId', () => {
  it('es el mismo id para los dos participantes, sin importar quién lo arma', () => {
    const id = conversationId(EMPLOYEE_ID, PSYCHOLOGIST_ID);

    expect(id).toBe(`${EMPLOYEE_ID}:${PSYCHOLOGIST_ID}`);
    expect(parseConversationId(id)).toEqual({
      employeeId: EMPLOYEE_ID,
      psychologistId: PSYCHOLOGIST_ID,
    });
  });
});

describe('parseConversationId', () => {
  it.each<[string, unknown]>([
    ['solo trae un lado', EMPLOYEE_ID],
    ['trae más de dos lados', `${EMPLOYEE_ID}:${PSYCHOLOGIST_ID}:otro`],
    ['el empleado está vacío', `:${PSYCHOLOGIST_ID}`],
    ['el psicólogo está vacío', `${EMPLOYEE_ID}:`],
  ])('devuelve null si %s', (_caso, valor) => {
    expect(parseConversationId(String(valor))).toBeNull();
  });
});

describe('mergeChatMessages', () => {
  it('ordena por hora lo que llegó en vivo con el historial', () => {
    const manana = mensaje({
      id: 'mensaje-3',
      sentAt: new Date(2026, 8, 23, 15).toISOString(),
    });
    const mediodia = mensaje({
      id: 'mensaje-2',
      senderId: PSYCHOLOGIST_ID,
      senderName: 'Laura Martínez',
      sentAt: new Date(2026, 8, 23, 10).toISOString(),
    });

    const merged = mergeChatMessages([manana], [mensaje(), mediodia]);

    expect(merged.map(({ id }) => id)).toEqual(['mensaje-1', 'mensaje-2', 'mensaje-3']);
  });

  it('no repite lo que ya había llegado en vivo', () => {
    const enVivo = mensaje({ text: 'Lo que llegó en vivo' });

    const merged = mergeChatMessages([mensaje({ text: 'Lo del historial' })], [enVivo]);

    expect(merged).toEqual([enVivo]);
  });
});
