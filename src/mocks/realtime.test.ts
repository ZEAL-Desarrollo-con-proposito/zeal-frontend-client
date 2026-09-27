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
