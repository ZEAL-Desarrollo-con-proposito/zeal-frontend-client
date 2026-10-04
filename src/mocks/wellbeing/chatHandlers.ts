import { CHATS_QUEUE, isChatOutgoing } from '@/features/chat/model/chatEvent';
import type { ChatMessage } from '@/features/chat/model/chatMessage';
import { conversationId, parseConversationId } from '@/features/chat/model/chatMessage';
import { publishToUser } from '../realtime';
import { readWellbeingDb } from './db';

const CHAT_SEND = /^\/app\/chats\/([^/]+)\/mensajes$/;

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

let sequence = 0;

/**
 * Enruta un mensaje de chat (HU-BE-09, contrato provisional): solo entre las dos personas de la conversación.
 * El servidor completa el resto del mensaje —`id`,remitente y hora— y lo reenvía a los dos y quien lo envió.
 */
export function handleChatMessage(userId: string, destination: string, payload: unknown): void {
  const encodedId = CHAT_SEND.exec(destination)?.[1];
  if (encodedId === undefined || !isChatOutgoing(payload)) {
    return;
  }
  const parsed = parseConversationId(decodeURIComponent(encodedId));
  if (parsed === null || (userId !== parsed.employeeId && userId !== parsed.psychologistId)) {
    return;
  }
  const { employeeId, psychologistId } = parsed;
  const haveMetBefore = readWellbeingDb().reservations.some(
    (reservation) =>
      reservation.employee.id === employeeId && reservation.psychologistId === psychologistId,
  );
  const name = senderName(userId, employeeId, psychologistId);
  if (!haveMetBefore || name === null) {
    return;
  }

  sequence += 1;
  const message: ChatMessage = {
    id: `mensaje-${String(Date.now())}-${String(sequence)}`,
    conversationId: conversationId(employeeId, psychologistId),
    senderId: userId,
    senderName: name,
    text: payload.text,
    sentAt: new Date().toISOString(),
  };
  publishToUser(employeeId, CHATS_QUEUE, { type: 'NUEVO', message });
  publishToUser(psychologistId, CHATS_QUEUE, { type: 'NUEVO', message });
}