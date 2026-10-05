import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeFactoryContext } from '@/shared/realtime/RealtimeContext';
import { RealtimeProvider } from '@/shared/realtime/RealtimeProvider';
import { FIXED_NOW, freezeTime } from '@/test/clock';
import { buildSession } from '@/test/credentials';
import { scriptedRealtimeClient } from '@/test/realtime';
import { chatTypingDestination } from '../model/chatEvent';
import { conversationId } from '../model/chatMessage';
import { useTypingEmitter } from './useTypingEmitter';

const CONVERSATION = conversationId('usr-empleado-001', 'usr-psicologo-001');
const OTRA_CONVERSACION = conversationId('usr-empleado-002', 'usr-psicologo-002');
const session = buildSession('EMPLEADO');

/** Los milisegundos que limitan los avisos, tal como los fijó el hook. */
const LIMITE_MS = 3_000;

function renderEmisor() {
  const realtime = scriptedRealtimeClient();
  const view = renderHook(
    ({ conversationId }: { conversationId: string }) => useTypingEmitter(conversationId),
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

describe('useTypingEmitter', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('avisa que empezó a escribir, una sola vez mientras sigue tecleando', () => {
    const { result, realtime } = renderEmisor();

    act(() => {
      result.current.notifyTyping(true);
    });
    act(() => {
      result.current.notifyTyping(true);
    });

    expect(realtime.published).toEqual([
      { destination: chatTypingDestination(CONVERSATION), payload: { typing: true } },
    ]);
  });

  it('repite el aviso cuando pasa el límite, por si el otro no lo alcanzó a oír', () => {
    const { result, realtime } = renderEmisor();
    act(() => {
      result.current.notifyTyping(true);
    });

    // Como en una pestaña de fondo: el reloj avanza más que el aviso pendiente.
    vi.setSystemTime(new Date(FIXED_NOW.getTime() + LIMITE_MS));
    act(() => {
      result.current.notifyTyping(true);
    });

    expect(realtime.published.map(({ payload }) => payload)).toEqual([
      { typing: true },
      { typing: true },
    ]);
  });

  it('avisa que dejó de escribir cuando se vacía la caja', () => {
    const { result, realtime } = renderEmisor();
    act(() => {
      result.current.notifyTyping(true);
    });

    act(() => {
      result.current.notifyTyping(false);
    });

    expect(realtime.published.map(({ payload }) => payload)).toEqual([
      { typing: true },
      { typing: false },
    ]);
  });

  it('con la caja vacía y sin estar escribiendo no avisa nada', () => {
    const { result, realtime } = renderEmisor();

    act(() => {
      result.current.notifyTyping(false);
    });

    expect(realtime.published).toEqual([]);
  });

  it('sin conexión no avisa nada', () => {
    const { result, realtime } = renderEmisor();
    act(() => {
      realtime.store.set('reconnecting');
    });

    act(() => {
      result.current.notifyTyping(true);
    });

    expect(realtime.published).toEqual([]);
  });

  it('al perderse la conexión no espera al límite para volver a avisar', () => {
    const { result, realtime } = renderEmisor();
    act(() => {
      result.current.notifyTyping(true);
    });

    act(() => {
      realtime.store.set('reconnecting');
    });
    act(() => {
      realtime.store.set('connected');
    });
    act(() => {
      result.current.notifyTyping(true);
    });

    expect(realtime.published.map(({ payload }) => payload)).toEqual([
      { typing: true },
      { typing: true },
    ]);
  });

  it('al cambiar de conversación avisa que dejó de escribir en la anterior', () => {
    const { result, realtime, rerender } = renderEmisor();
    act(() => {
      result.current.notifyTyping(true);
    });

    rerender({ conversationId: OTRA_CONVERSACION });

    expect(realtime.published).toEqual([
      { destination: chatTypingDestination(CONVERSATION), payload: { typing: true } },
      { destination: chatTypingDestination(CONVERSATION), payload: { typing: false } },
    ]);
  });

  it('al salir de la conversación avisa que dejó de escribir', () => {
    const { result, realtime, unmount } = renderEmisor();
    act(() => {
      result.current.notifyTyping(true);
    });

    unmount();

    expect(realtime.published.map(({ payload }) => payload)).toEqual([
      { typing: true },
      { typing: false },
    ]);
  });
});

describe('useTypingEmitter al quedarse quieto', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(FIXED_NOW);
  });

  it('avisa que dejó de escribir tras unos segundos sin teclear', () => {
    const { result, realtime } = renderEmisor();
    act(() => {
      result.current.notifyTyping(true);
    });

    act(() => {
      vi.advanceTimersByTime(LIMITE_MS);
    });

    expect(realtime.published.map(({ payload }) => payload)).toEqual([
      { typing: true },
      { typing: false },
    ]);
  });

  it('sigue escribiendo renueva la espera, así que no se adelanta al último tecleo', () => {
    const { result, realtime } = renderEmisor();
    act(() => {
      result.current.notifyTyping(true);
    });

    act(() => {
      vi.advanceTimersByTime(LIMITE_MS - 1_000);
    });
    act(() => {
      result.current.notifyTyping(true);
    });
    // La cuenta se reinició con el último tecleo: todavía no se avisó que dejó de escribir.
    act(() => {
      vi.advanceTimersByTime(LIMITE_MS - 1_000);
    });
    expect(realtime.published.map(({ payload }) => payload)).toEqual([{ typing: true }]);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(realtime.published.map(({ payload }) => payload)).toEqual([
      { typing: true },
      { typing: false },
    ]);
  });
});
