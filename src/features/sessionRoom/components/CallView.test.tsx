import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { asMediaStream, FakeStream } from '@/test/webrtc';
import type { CallSnapshot } from '../call/callSession';
import { INITIAL_CALL } from '../call/callSession';
import { CallView } from './CallView';

const stream = asMediaStream(new FakeStream());

function callView(call: CallSnapshot) {
  return (
    <CallView
      participant="David Cajamarca"
      selfName="Laura Martínez"
      call={call}
      localStream={stream}
      media={{ audio: true, video: true }}
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
    const { rerender } = render(callView(INITIAL_CALL));
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Esperando a que David Cajamarca entre a la sala…');

    // Dos cambios seguidos (la otra persona sale mientras se conecta): siempre se lee el último.
    rerender(callView({ ...INITIAL_CALL, status: 'connecting' }));
    expect(status).toHaveTextContent(/^Conectando el video…$/);

    rerender(callView({ ...INITIAL_CALL, status: 'waiting', remoteLeft: true }));
    expect(status).toHaveTextContent(
      /^David Cajamarca salió de la sala\. Puedes esperar a que vuelva o salir tú también\.$/,
    );
  });
});
