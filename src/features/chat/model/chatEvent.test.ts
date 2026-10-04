import { describe, expect, it } from 'vitest';
import type { ChatMessage } from './chatMessage';
import { CHATS_QUEUE, chatSendDestination, isChatEvent, isChatOutgoing } from './chatEvent';

const MENSAJE: ChatMessage = {
  id: 'mensaje-1',
  conversationId: 'usr-empleado-001:usr-psicologo-001',
  senderId: 'usr-psicologo-001',
  senderName: 'Laura Martínez',
  text: 'Escribe cuando quieras',
  sentAt: new Date(2026, 8, 23, 9, 15).toISOString(),
};

describe('CHATS_QUEUE', () => {
  it('es la cola privada de la persona, no un tema público', () => {
    expect(CHATS_QUEUE).toBe('/user/queue/chats');
  });
});

describe('chatSendDestination', () => {
  it('codifica la conversación en el destino del envío', () => {
    expect(chatSendDestination(MENSAJE.conversationId)).toBe(
      '/app/chats/usr-empleado-001%3Ausr-psicologo-001/mensajes',
    );
  });
});

describe('isChatOutgoing', () => {
  it('acepta un texto con contenido', () => {
    expect(isChatOutgoing({ text: 'Hola' })).toBe(true);
  });

  it.each<[string, unknown]>([
    ['no es un objeto', 'Hola'],
    ['no trae texto', {}],
    ['el texto está en blanco', { text: '   ' }],
    ['el texto no es texto', { text: 42 }],
  ])('rechaza %s', (_caso, valor) => {
    expect(isChatOutgoing(valor)).toBe(false);
  });
});

describe('isChatEvent', () => {
  it('acepta un mensaje nuevo de la cola privada', () => {
    expect(isChatEvent({ type: 'NUEVO', message: MENSAJE })).toBe(true);
  });

  it.each<[string, unknown]>([
    ['no es un objeto', 'NUEVO'],
    ['es de otro tipo', { type: 'BORRADO', message: MENSAJE }],
    ['no trae mensaje', { type: 'NUEVO' }],
    ['el mensaje está incompleto', { type: 'NUEVO', message: { id: 'mensaje-1' } }],
  ])('rechaza %s', (_caso, valor) => {
    expect(isChatEvent(valor)).toBe(false);
  });
});
