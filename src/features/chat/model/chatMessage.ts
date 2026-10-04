import { isRecord } from '@/features/auth/model/session';

/**
 * Un mensaje de la conversación entre un empleado y su psicólogo (HU-FE-09). El estado y el
 * `id` los asigna siempre el servidor, incluso para el mensaje que uno mismo acaba de enviar.
 */
export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  sentAt: string;
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export function isChatMessage(value: unknown): value is ChatMessage {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.conversationId === 'string' &&
    typeof value.senderId === 'string' &&
    typeof value.senderName === 'string' &&
    typeof value.text === 'string' &&
    value.text.trim() !== '' &&
    isIsoDateTime(value.sentAt)
  );
}

/**
 * Identifica la conversación entre un empleado y un psicólogo.
 * siempre con el mismo id
 */
export function conversationId(employeeId: string, psychologistId: string): string {
  return `${employeeId}:${psychologistId}`;
}

/** la deshace si no tiene el formato esperado*/
export function parseConversationId(
  value: string,
): { employeeId: string; psychologistId: string } | null {
  const parts = value.split(':');
  if (parts.length !== 2) {
    return null;
  }
  const [employeeId, psychologistId] = parts;
  if (
    employeeId === undefined ||
    employeeId === '' ||
    psychologistId === undefined ||
    psychologistId === ''
  ) {
    return null;
  }
  return { employeeId, psychologistId };
}