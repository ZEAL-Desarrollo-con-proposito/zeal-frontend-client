import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { EMPLOYEE_PATHS } from '@/app/paths';
import { MY_APPOINTMENTS_ENDPOINT } from '@/features/appointments/api/appointmentsApi';
import { server } from '@/mocks/server';
import { appendChatMessage } from '@/mocks/wellbeing/chatDb';
import { freezeTime } from '@/test/clock';
import { storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import { conversationId } from '../model/chatMessage';

const CONVERSATION = conversationId('usr-empleado-001', 'usr-psicologo-001');

function abrirMensajes() {
  storeSession('EMPLEADO');
  return renderRoute(EMPLOYEE_PATHS.messages);
}

describe('Mensajes del empleado (HU-FE-09)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('es la pantalla de llegada y explica la privacidad de la conversación', () => {
    abrirMensajes();

    expect(screen.getByRole('heading', { level: 1, name: 'Mensajes' })).toBeInTheDocument();
    expect(
      screen.getByText('Tus conversaciones son privadas y cifradas de extremo a extremo.'),
    ).toBeInTheDocument();
  });

  it('mientras pide sus citas avisa que está cargando', () => {
    abrirMensajes();

    expect(screen.getByText('Cargando…')).toHaveAttribute('aria-busy', 'true');
  });

  it('abre la conversación con la psicóloga de su cita más próxima', async () => {
    abrirMensajes();

    expect(
      await screen.findByRole('region', { name: 'Chat con Laura Martínez' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Psicóloga clínica')).toBeInTheDocument();
  });

  it('muestra el historial que le entrega el servidor', async () => {
    appendChatMessage({
      id: 'mensaje-1',
      conversationId: CONVERSATION,
      senderId: 'usr-psicologo-001',
      senderName: 'Laura Martínez',
      text: '¿Cómo amaneciste?',
      sentAt: new Date(2026, 8, 23, 8).toISOString(),
    });

    abrirMensajes();

    expect(await screen.findByText('¿Cómo amaneciste?')).toBeInTheDocument();
    expect(screen.getByRole('log', { name: 'Mensajes con Laura Martínez' })).toBeInTheDocument();
  });

  it('invita a reservar una cita cuando todavía no tiene con quién hablar', async () => {
    server.use(http.get(`*${MY_APPOINTMENTS_ENDPOINT}`, () => HttpResponse.json([])));

    abrirMensajes();

    expect(await screen.findByText('Aún no tienes una conversación abierta.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a Bienestar' })).toHaveAttribute(
      'href',
      EMPLOYEE_PATHS.wellbeing,
    );
  });

  it('si no pudo cargar sus citas lo avisa y el reintento las vuelve a pedir', async () => {
    server.use(
      http.get(`*${MY_APPOINTMENTS_ENDPOINT}`, () =>
        HttpResponse.json({ message: 'Sin servicio' }, { status: 500 }),
      ),
    );
    const { user } = abrirMensajes();

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tus citas.');

    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(
      await screen.findByRole('region', { name: 'Chat con Laura Martínez' }),
    ).toBeInTheDocument();
  });
});
