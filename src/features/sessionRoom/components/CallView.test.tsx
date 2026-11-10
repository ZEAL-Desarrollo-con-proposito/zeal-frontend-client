import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CallParticipant, VideoCallSnapshot } from '@/features/videoCall/call/videoCall';
import { CallView } from './CallView';

function person(fields: Partial<CallParticipant> & { id: string; name: string }): CallParticipant {
  return {
    host: false,
    self: false,
    stream: null,
    media: { audio: true, video: true },
    speaking: false,
    ...fields,
  };
}

const LAURA = person({ id: 'usr-psicologo-001', name: 'Laura Martínez', self: true });
const DAVID = person({ id: 'usr-empleado-001', name: 'David Cajamarca' });

function callView(snapshot: VideoCallSnapshot) {
  return (
    <CallView
      participant="David Cajamarca"
      selfName="Laura Martínez"
      snapshot={snapshot}
      media={{ audio: true, video: true }}
      mediaError={null}
      onToggleAudio={() => undefined}
      onToggleVideo={() => undefined}
      onLeave={() => undefined}
      chat={{ open: false, unread: 0, onToggle: () => undefined }}
      chatPanel={null}
    />
  );
}

describe('CallView', () => {
  it('el aviso de estado cambia junto con la llamada, sin esperar a que salga el anterior', () => {
    const { rerender } = render(callView({ status: 'connected', participants: [LAURA] }));
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Esperando a que David Cajamarca entre a la sala…');

    // Varios cambios seguidos: siempre se lee el último.
    rerender(callView({ status: 'connected', participants: [LAURA, DAVID] }));
    expect(status).toHaveTextContent(/^Conectado con David Cajamarca$/);

    rerender(callView({ status: 'reconnecting', participants: [LAURA, DAVID] }));
    expect(status).toHaveTextContent(/^Se perdió la conexión\. Reconectando…$/);

    rerender(callView({ status: 'connected', participants: [LAURA] }));
    expect(status).toHaveTextContent(
      /^David Cajamarca salió de la sala\. Puedes esperar a que vuelva o salir tú también\.$/,
    );
  });

  it('con el video de la otra persona lo muestra en lugar de sus iniciales', () => {
    const stream = {} as unknown as MediaStream;
    render(callView({ status: 'connected', participants: [LAURA, { ...DAVID, stream }] }));

    const video = screen.getByRole('figure', { name: 'David Cajamarca' }).querySelector('video');
    expect(video).toHaveAttribute('data-visible', 'true');
    expect(video?.srcObject).toBe(stream);
  });

  it('mientras el servidor aún no entrega ninguna imagen, muestra las iniciales de los dos', () => {
    render(callView({ status: 'connected', participants: [] }));

    for (const name of ['David Cajamarca', 'Tú']) {
      expect(screen.getByRole('figure', { name: new RegExp(`^${name}`) })).toHaveTextContent(
        /^(DC|LM)/,
      );
    }
  });
});
