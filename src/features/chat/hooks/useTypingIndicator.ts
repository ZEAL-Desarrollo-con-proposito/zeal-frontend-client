import { useEffect, useRef, useState } from 'react';
import { useRealtimeSubscription } from '@/shared/realtime/useRealtime';
import { CHATS_QUEUE, isChatTypingEvent } from '../model/chatEvent';

/** Si no llega un aviso de "dejó de escribir" en este tiempo. */
const TYPING_TIMEOUT_MS = 5_000;

/**
 * Si la otra persona está escribiendo ahora mismo en esta conversación (HU-FE-10).
 * El aviso caduca solo a los 5 s sin un nuevo "sigue escribiendo".
 */
export function useTypingIndicator(conversationId: string, currentUserId: string): boolean {
  const [typing, setTyping] = useState(false);
  const [trackedConversation, setTrackedConversation] = useState(conversationId);
  const timeoutRef = useRef<number | null>(null);

  function clearPending() {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  // Cambiar de conversación olvida que la anterior estaba escribiendo.
  if (trackedConversation !== conversationId) {
    setTrackedConversation(conversationId);
    setTyping(false);
  }

  // Limpiar el temporizador pendiente fuera del render (aquí sí se pueden tocar refs).
  useEffect(() => clearPending, [conversationId]);

  useRealtimeSubscription(CHATS_QUEUE, (payload) => {
    if (
      !isChatTypingEvent(payload) ||
      payload.conversationId !== conversationId ||
      payload.userId === currentUserId
    ) {
      return;
    }
    clearPending();
    setTyping(payload.typing);
    if (payload.typing) {
      timeoutRef.current = window.setTimeout(() => {
        setTyping(false);
      }, TYPING_TIMEOUT_MS);
    }
  });

  return typing;
}
