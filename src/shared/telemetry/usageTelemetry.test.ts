import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createUsageTelemetry,
  flushUsage,
  trackUsage,
  USAGE_MAX_EVENTS,
  USAGE_REPORT_EVERY_MS,
  type UsageTelemetryName,
} from './usageTelemetry';

type Send = (report: { events: { type: 'uso'; name: UsageTelemetryName }[] }) => Promise<void>;

function setup({ send = vi.fn<Send>(() => Promise.resolve()) }: { send?: Send } = {}) {
  const usage = createUsageTelemetry({ send });
  return { send, usage };
}

describe('usageTelemetry', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('acumula el uso y lo envía cada 30 s', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { send, usage } = setup();

    usage.track('login');
    vi.advanceTimersByTime(USAGE_REPORT_EVERY_MS - 1);
    expect(send).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledWith({
      events: [{ type: 'uso', name: 'login' }],
    });

    usage.track('tomar_cupo');
    vi.advanceTimersByTime(USAGE_REPORT_EVERY_MS);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('envía solo los eventos pendientes y no reintenta un fallo de envío', async () => {
    const send = vi.fn<Send>(() => Promise.reject(new Error('sin red')));
    const usage = createUsageTelemetry({ send });

    usage.track('postular');
    usage.flush();
    await Promise.resolve();

    expect(send).toHaveBeenCalledOnce();
  });

  it('envía lo acumulado al ocultarse la pestaña', () => {
    trackUsage('login');
    expect(() => {
      flushUsage();
    }).not.toThrow();
    flushUsage();
    window.dispatchEvent(new Event('visibilitychange'));
  });

  it('envía el lote en cuanto llega al máximo y no descarta el uso que sigue', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const send = vi.fn<Send>(() => Promise.resolve());
    const usage = createUsageTelemetry({ send });

    for (let index = 0; index < USAGE_MAX_EVENTS + 2; index += 1) {
      usage.track('chat_enviado');
    }

    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[0]?.events).toHaveLength(USAGE_MAX_EVENTS);

    vi.advanceTimersByTime(USAGE_REPORT_EVERY_MS);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]?.[0]?.events).toHaveLength(2);
  });
});
