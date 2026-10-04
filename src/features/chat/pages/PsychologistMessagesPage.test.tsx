import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { PSYCHOLOGIST_PATHS } from '@/app/paths';
import { AGENDA_ENDPOINT } from '@/features/agenda/api/agendaApi';
import { server } from '@/mocks/server';
import { appendChatMessage } from '@/mocks/wellbeing/chatDb';
import { freezeTime } from '@/test/clock';
import { storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import { conversationId } from '../model/chatMessage';

const CONVERSATION = conversationId('usr-empleado-001', 'usr-psicologo-001');

function abrirMensajes() {
  storeSession('PSICOLOGO');
  return renderRoute(PSYCHOLOGIST_PATHS.messages);
}

describe('Mensajes del psicólogo (HU-FE-09)', () => {
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

  it('mientras carga la agenda avisa que está cargando', () => {
    abrirMensajes();

    expect(screen.getByText('Cargando…')).toHaveAttribute('aria-busy', 'true');
  });

  it('abre la conversación con el empleado de su reserva más próxima', async () => {
    abrirMensajes();

    expect(
      await screen.findByRole('region', { name: 'Chat con David Cajamarca' }),
    ).toBeInTheDocument();
  });

  it('muestra el historial que le entrega el servidor', async () => {
    appendChatMessage({
      id: 'mensaje-1',
      conversationId: CONVERSATION,
      senderId: 'usr-empleado-001',
      senderName: 'David Cajamarca',
      text: 'Buenos días',
      sentAt: new Date(2026, 8, 23, 8).toISOString(),
    });

    abrirMensajes();

    expect(await screen.findByText('Buenos días')).toBeInTheDocument();
    expect(screen.getByText('David Cajamarca:')).toBeInTheDocument();
  });

  it('invita a esperar una reserva cuando todavía no tiene con quién hablar', async () => {
    server.use(http.get(`*${AGENDA_ENDPOINT}`, () => HttpResponse.json([])));

    abrirMensajes();

    expect(await screen.findByText('Aún no tienes una conversación abierta.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a mi agenda' })).toHaveAttribute(
      'href',
      PSYCHOLOGIST_PATHS.agenda,
    );
  });

  it('si no pudo cargar la agenda lo avisa y el reintento la vuelve a pedir', async () => {
    server.use(
      http.get(`*${AGENDA_ENDPOINT}`, () => HttpResponse.json({ message: 'x' }, { status: 500 })),
    );
    const { user } = abrirMensajes();

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tu agenda.');

    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(
      await screen.findByRole('region', { name: 'Chat con David Cajamarca' }),
    ).toBeInTheDocument();
  });
});
