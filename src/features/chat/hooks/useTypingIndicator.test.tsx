import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeFactoryContext } from '@/shared/realtime/RealtimeContext';
import { RealtimeProvider } from '@/shared/realtime/RealtimeProvider';
import { FIXED_NOW } from '@/test/clock';
import { buildSession } from '@/test/credentials';
import { scriptedRealtimeClient } from '@/test/realtime';
import { CHATS_QUEUE } from '../model/chatEvent';
import { conversationId } from '../model/chatMessage';
import { useTypingIndicator } from './useTypingIndicator';

const EMPLOYEE = 'usr-empleado-001';
const PSYCHOLOGIST = 'usr-psicologo-001';
const CONVERSATION = conversationId(EMPLOYEE, PSYCHOLOGIST);
const OTRA_CONVERSACION = conversationId('usr-empleado-002', 'usr-psicologo-002');
const session = buildSession('EMPLEADO');

function renderIndicador() {
  const realtime = scriptedRealtimeClient();
  const view = renderHook(
    ({ conversationId }: { conversationId: string }) =>
      useTypingIndicator(conversationId, EMPLOYEE),
    {
      initialProps: { conversationId: CONVERSATION },
      wrapper: ({ children }: { children: ReactNode }) => (
        <RealtimeFactoryContext value={() => realtime.client}>
          <RealtimeProvider accessToken={session.accessToken}>{children}</RealtimeProvider>
        </RealtimeFactoryContext>
      ),
    },
  );
  return { ...view, realtime };
}

function escribiendo(overrides: Record<string, unknown> = {}) {
  return {
    type: 'ESCRIBIENDO',
    conversationId: CONVERSATION,
    userId: PSYCHOLOGIST,
    typing: true,
    ...overrides,
  };
}

describe('useTypingIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(FIXED_NOW);
  });

  it('arranca sin que nadie esté escribiendo', () => {
    const { result } = renderIndicador();

    expect(result.current).toBe(false);
  });

  it('mientras la otra persona escribe lo muestra', () => {
    const { result, realtime } = renderIndicador();

    act(() => {
      realtime.deliver(CHATS_QUEUE, escribiendo());
    });

    expect(result.current).toBe(true);
  });

  it('el aviso caduca a los cinco segundos para no quedarse pegado', () => {
    const { result, realtime } = renderIndicador();
    act(() => {
      realtime.deliver(CHATS_QUEUE, escribiendo());
    });
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(result.current).toBe(false);
  });

  it('desaparece en cuanto llega el aviso de que dejó de escribir', () => {
    const { result, realtime } = renderIndicador();
    act(() => {
      realtime.deliver(CHATS_QUEUE, escribiendo());
    });

    act(() => {
      realtime.deliver(CHATS_QUEUE, escribiendo({ typing: false }));
      vi.advanceTimersByTime(5_000);
    });

    expect(result.current).toBe(false);
  });

  it('ignora lo que no es un aviso de escritura, lo de otra conversación y lo propio', () => {
    const { result, realtime } = renderIndicador();

    act(() => {
      realtime.deliver(CHATS_QUEUE, 'hola');
      realtime.deliver(CHATS_QUEUE, { type: 'NUEVO' });
      realtime.deliver(CHATS_QUEUE, escribiendo({ conversationId: OTRA_CONVERSACION }));
      realtime.deliver(CHATS_QUEUE, escribiendo({ userId: EMPLOYEE }));
    });

    expect(result.current).toBe(false);
  });

  it('al cambiar de conversación olvida que la anterior estaba escribiendo', () => {
    const { result, realtime, rerender } = renderIndicador();
    act(() => {
      realtime.deliver(CHATS_QUEUE, escribiendo());
    });
    expect(result.current).toBe(true);

    rerender({ conversationId: OTRA_CONVERSACION });

    expect(result.current).toBe(false);
  });

  it('al salir cancela el aviso pendiente para no dejar el temporizador vivo', () => {
    const { result, realtime, unmount } = renderIndicador();
    act(() => {
      realtime.deliver(CHATS_QUEUE, escribiendo());
    });
    const cancelar = vi.spyOn(window, 'clearTimeout');

    unmount();
    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(cancelar).toHaveBeenCalled();
    expect(result.current).toBe(true);
  });
});
