import type { ChatTypingEvent } from '@/features/chat/model/chatEvent';
import { CHATS_QUEUE, isChatOutgoing, isChatTypingOutgoing } from '@/features/chat/model/chatEvent';
import type { ChatMessage } from '@/features/chat/model/chatMessage';
import { conversationId, parseConversationId } from '@/features/chat/model/chatMessage';
import { combineMockMessageHandlers, publishToUser } from '../realtime';
import { appendChatMessage } from './chatDb';
import { readWellbeingDb } from './db';

const CHAT_SEND = /^\/app\/chats\/([^/]+)\/mensajes$/;
const TYPING_SEND = /^\/app\/chats\/([^/]+)\/escribiendo$/;

/** Nombre para mostrar de quien envía, o `null` si no está en los datos del Wellbeing Service. */
function senderName(userId: string, employeeId: string, psychologistId: string): string | null {
  const db = readWellbeingDb();
  if (userId === employeeId) {
    return (
      db.reservations.find((reservation) => reservation.employee.id === employeeId)?.employee
        .fullName ?? null
    );
  }
  if (userId === psychologistId) {
    return db.psychologists.find(({ id }) => id === psychologistId)?.fullName ?? null;
  }
  return null;
}

/** Los dos participantes, si `userId` es uno de ellos y alguna vez tuvieron una sesión juntos. */
function parseParticipant(userId: string, encodedId: string) {
  const parsed = parseConversationId(decodeURIComponent(encodedId));
  if (parsed === null || (userId !== parsed.employeeId && userId !== parsed.psychologistId)) {
    return null;
  }
  const haveMetBefore = readWellbeingDb().reservations.some(
    (reservation) =>
      reservation.employee.id === parsed.employeeId &&
      reservation.psychologistId === parsed.psychologistId,
  );
  return haveMetBefore ? parsed : null;
}

let sequence = 0;

/**
 * Enruta un mensaje de chat (HU-BE-09, contrato provisional): solo entre las dos personas de la conversación.
 * El servidor completa el resto del mensaje —`id`, remitente y hora— y lo reenvía a los dos y quien lo envió.
 */
function routeChatMessage(userId: string, destination: string, payload: unknown): void {
  const encodedId = CHAT_SEND.exec(destination)?.[1];
  if (encodedId === undefined || !isChatOutgoing(payload)) {
    return;
  }
  const parsed = parseParticipant(userId, encodedId);
  const name =
    parsed === null ? null : senderName(userId, parsed.employeeId, parsed.psychologistId);
  if (parsed === null || name === null) {
    return;
  }
  const { employeeId, psychologistId } = parsed;

  sequence += 1;
  const message: ChatMessage = {
    id: `mensaje-${String(Date.now())}-${String(sequence)}`,
    conversationId: conversationId(employeeId, psychologistId),
    senderId: userId,
    senderName: name,
    text: payload.text,
    sentAt: new Date().toISOString(),
  };
  // Como el backend real: el mensaje queda en el historial antes de reenviarlo.
  appendChatMessage(message);
  publishToUser(employeeId, CHATS_QUEUE, { type: 'NUEVO', message });
  publishToUser(psychologistId, CHATS_QUEUE, { type: 'NUEVO', message });
  publishToUser(userId, CHATS_QUEUE, { type: 'NUEVO', message }); // eco al remitente
}

/**
 * Enruta el aviso de "escribiendo" (HU-BE-10, contrato provisional · Task 355): solo a la otra
 * persona de la conversación, nunca a quien lo envía — ella ya sabe que está escribiendo.
 */
function routeChatTyping(userId: string, destination: string, payload: unknown): void {
  const encodedId = TYPING_SEND.exec(destination)?.[1];
  if (encodedId === undefined || !isChatTypingOutgoing(payload)) {
    return;
  }
  const parsed = parseParticipant(userId, encodedId);
  if (parsed === null) {
    return;
  }
  const { employeeId, psychologistId } = parsed;
  const recipientId = userId === employeeId ? psychologistId : employeeId;
  const event: ChatTypingEvent = {
    type: 'ESCRIBIENDO',
    conversationId: conversationId(employeeId, psychologistId),
    userId,
    typing: payload.typing,
  };
  publishToUser(recipientId, CHATS_QUEUE, event);
}

export const handleChatMessage = combineMockMessageHandlers(routeChatMessage, routeChatTyping);
