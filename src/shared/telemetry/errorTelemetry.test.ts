import { describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError } from '@/shared/api/errors';
import type { ErrorTelemetryReport } from './errorTelemetry';
import { createErrorTelemetry, installErrorTelemetry, reportError } from './errorTelemetry';

type Send = (
  report: ErrorTelemetryReport,
  options: { keepalive: boolean; requestId: string },
) => Promise<void>;

function setup({ route = '/empleado/mis-citas' }: { route?: string | null } = {}) {
  const send = vi.fn<Send>(() => Promise.resolve());
  const telemetry = createErrorTelemetry({
    send,
    route: () => route,
    id: () => 'generado-12345678',
  });
  return { send, telemetry };
}

describe('errorTelemetry', () => {
  it('reporta un error JS con una ruta saneada y un X-Request-Id nuevo', () => {
    const { send, telemetry } = setup();

    telemetry.report(new Error('Fallo inesperado'));

    expect(send).toHaveBeenCalledExactlyOnceWith(
      { events: [{ type: 'error', name: 'error_js', route: '/empleado/mis-citas' }] },
      { keepalive: true, requestId: 'generado-12345678' },
    );
  });

  it.each([
    ['un fallo del API', new ApiError(500, 'Error', null, 'servidor-12345678'), 'error_api'],
    ['una caída de red', new NetworkError({ requestId: 'red-12345678' }), 'error_api'],
    ['un valor sin forma de error', 42, 'error_js'],
    [
      'un paquete que ya no existe',
      new Error('Failed to fetch dynamically imported module: /assets/page.js'),
      'chunk_load',
    ],
    ['un error de texto de paquete obsoleto', 'Loading chunk 7 failed', 'chunk_load'],
    [
      'un ChunkLoadError',
      Object.assign(new Error('Loading chunk 7 failed'), { name: 'ChunkLoadError' }),
      'chunk_load',
    ],
  ])('clasifica %s como %s', (_case, error, name) => {
    const { send, telemetry } = setup();

    telemetry.report(error);

    expect(send).toHaveBeenCalledWith(
      { events: [{ type: 'error', name, route: '/empleado/mis-citas' }] },
      expect.objectContaining({ keepalive: true }),
    );
  });

  it('reutiliza el X-Request-Id de la petición que falló', () => {
    const { send, telemetry } = setup();
    const error = new ApiError(503, undefined, null, 'servidor-12345678');

    telemetry.report(error);

    expect(send).toHaveBeenCalledWith(expect.anything(), {
      keepalive: true,
      requestId: 'servidor-12345678',
    });
  });

  it('permite forzar el nombre y la correlación cuando el contexto los conoce', () => {
    const { send, telemetry } = setup();

    telemetry.report(undefined, { name: 'ws_desconectado', requestId: 'ws-12345678' });

    expect(send).toHaveBeenCalledWith(
      { events: [{ type: 'error', name: 'ws_desconectado', route: '/empleado/mis-citas' }] },
      { keepalive: true, requestId: 'ws-12345678' },
    );
  });

  it('omite la ruta cuando no hay una válida', () => {
    const { send, telemetry } = setup({ route: null });

    telemetry.report(new Error('Fallo'));

    expect(send).toHaveBeenCalledWith(
      { events: [{ type: 'error', name: 'error_js' }] },
      expect.anything(),
    );
  });

  it('ignora cancelaciones, errores ya reportados y fallos de la propia telemetría', async () => {
    const { send, telemetry } = setup();
    send.mockRejectedValue(new Error('sin red'));
    const error = new Error('Fallo');

    telemetry.report(error);
    telemetry.report(error);
    telemetry.report(new DOMException('Cancelado', 'AbortError'));
    await Promise.resolve();

    expect(send).toHaveBeenCalledOnce();
  });
});

const createTarget = () => new EventTarget();

describe('reportError', () => {
  it('usa el reportero por defecto', () => {
    expect(() => {
      reportError(new Error('Fallo por defecto'));
    }).not.toThrow();
  });
});

describe('installErrorTelemetry', () => {
  it('escucha errores globales, promesas rechazadas y paquetes obsoletos hasta que se desinstala', () => {
    const target = createTarget();
    const report = vi.fn();
    const uninstall = installErrorTelemetry(target, report);
    const error = new Error('Fallo global');

    target.dispatchEvent(new ErrorEvent('error', { error }));
    target.dispatchEvent(new Event('unhandledrejection'));
    target.dispatchEvent(new Event('vite:preloadError'));

    expect(report).toHaveBeenNthCalledWith(1, error);
    expect(report).toHaveBeenNthCalledWith(2, undefined);
    expect(report).toHaveBeenNthCalledWith(3, expect.any(Event), { name: 'chunk_load' });

    uninstall();
    report.mockClear();
    target.dispatchEvent(new ErrorEvent('error', { error: new Error('Fallo global') }));
    expect(report).not.toHaveBeenCalled();
  });

  it('usa el mensaje cuando el navegador no entrega el objeto de error', () => {
    const target = createTarget();
    const report = vi.fn();
    const uninstall = installErrorTelemetry(target, report);

    target.dispatchEvent(new ErrorEvent('error', { message: 'Script error.' }));

    expect(report).toHaveBeenCalledWith('Script error.');
    uninstall();
  });
});
