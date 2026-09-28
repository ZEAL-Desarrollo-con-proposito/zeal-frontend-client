import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RealtimeClient } from '@/shared/realtime/realtimeClient';
import { buildSession } from '@/test/credentials';
import { createMockRealtimeClient, publishMockEvent, publishToUser } from './realtime';

const QUEUE = '/user/queue/notificaciones';
const clients: RealtimeClient[] = [];

function connectedClient(accessToken?: string) {
  const client = createMockRealtimeClient(accessToken);
  client.connect();
  clients.push(client);
  const received = vi.fn();
  client.subscribe(QUEUE, received);
  client.subscribe('/topic/franjas', received);
  return received;
}

describe('Real-Time Gateway simulado · mensajes de los clientes', () => {
  it('el servidor recibe quién envía, a qué destino y una copia del contenido', () => {
    const onMessage = vi.fn();
    const payload = { type: 'LISTO' };
    const david = createMockRealtimeClient(buildSession('EMPLEADO').accessToken, onMessage);
    const anonymous = createMockRealtimeClient(undefined, onMessage);

    david.publish('/app/salas/r-1/senales', payload);
    david.connect();
    anonymous.connect();
    clients.push(david, anonymous);
    david.publish('/app/salas/r-1/senales', payload);
    anonymous.publish('/app/salas/r-1/senales', payload);

    expect(onMessage).toHaveBeenCalledExactlyOnceWith(
      'usr-empleado-001',
      '/app/salas/r-1/senales',
      payload,
    );
    expect(onMessage.mock.calls[0]?.[2]).not.toBe(payload);
  });

  it('sin quien lo procese, lo que se envía se descarta', () => {
    const client = createMockRealtimeClient(buildSession('EMPLEADO').accessToken);
    client.connect();
    clients.push(client);

    expect(() => {
      client.publish('/app/otro', {});
    }).not.toThrow();
  });
});

describe('Real-Time Gateway simulado · destinos de usuario', () => {
  afterEach(() => {
    clients.splice(0).forEach((client) => {
      client.disconnect();
    });
  });

  it('entrega la cola privada solo a su dueño y los temas a todas las sesiones', async () => {
    const david = connectedClient(buildSession('EMPLEADO').accessToken);
    const laura = connectedClient(buildSession('PSICOLOGO').accessToken);
    const anonymous = connectedClient();

    publishToUser('usr-empleado-001', QUEUE, 'para David');
    publishMockEvent('/topic/franjas', 'para todos');

    await waitFor(() => {
      expect(anonymous).toHaveBeenCalledWith('para todos');
    });
    await waitFor(() => {
      expect(david).toHaveBeenCalledTimes(2);
    });
    expect(david).toHaveBeenCalledWith('para David');
    expect(laura).toHaveBeenCalledTimes(1);
    expect(laura).not.toHaveBeenCalledWith('para David');
    expect(anonymous).toHaveBeenCalledTimes(1);
  });
});
