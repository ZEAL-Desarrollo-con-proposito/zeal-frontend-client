import { useCallback, useEffect, useRef } from 'react';
import { useRealtimePublish, useRealtimeStatus } from '@/shared/realtime/useRealtime';
import type { ChatTypingOutgoing } from '../model/chatEvent';
import { chatTypingDestination } from '../model/chatEvent';

/** No más de un aviso de "escribiendo" cada tanto, para no saturar el canal. */
const TYPING_THROTTLE_MS = 3_000;
const TYPING_IDLE_MS = 3_000;

/**
 * Emite el evento de escritura de esta conversación (HU-FE-10): limitado mientras se
 * sigue tecleando, y avisa el fin al enviar, al vaciar la caja o tras quedarse quieto.
 */
export function useTypingEmitter(conversationId: string) {
  const publish = useRealtimePublish();
  const { status } = useRealtimeStatus();
  const connected = status === 'connected';
  const lastSentAtRef = useRef(0);
  const idleTimeoutRef = useRef<number | null>(null);
  const typingRef = useRef(false);

  const send = useCallback(
    (typing: boolean) => {
      publish(chatTypingDestination(conversationId), { typing } satisfies ChatTypingOutgoing);
      typingRef.current = typing;
    },
    [publish, conversationId],
  );

  const clearIdleTimer = useCallback(() => {
    if (idleTimeoutRef.current !== null) {
      window.clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
  }, []);

  const stopTyping = useCallback(() => {
    clearIdleTimer();
    if (typingRef.current) {
      send(false);
    }
    lastSentAtRef.current = 0;
  }, [clearIdleTimer, send]);

  // Sin conexión no hay nada que avisar: se olvida lo anterior para no esperar el límite al volver.
  useEffect(() => {
    if (!connected) {
      clearIdleTimer();
      typingRef.current = false;
      lastSentAtRef.current = 0;
    }
  }, [connected, clearIdleTimer]);

  // Cambiar de conversación o desmontar deja de avisar que se está escribiendo en la anterior.
  useEffect(() => stopTyping, [conversationId, stopTyping]);

  const notifyTyping = useCallback(
    (hasText: boolean) => {
      if (!connected) {
        return;
      }
      if (!hasText) {
        stopTyping();
        return;
      }
      const now = Date.now();
      if (!typingRef.current || now - lastSentAtRef.current >= TYPING_THROTTLE_MS) {
        send(true);
        lastSentAtRef.current = now;
      }
      clearIdleTimer();
      idleTimeoutRef.current = window.setTimeout(stopTyping, TYPING_IDLE_MS);
    },
    [connected, send, stopTyping, clearIdleTimer],
  );

  return { notifyTyping, stopTyping };
}
