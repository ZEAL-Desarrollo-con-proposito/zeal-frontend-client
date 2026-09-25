import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Reservation } from '../model/reservation';
import { JoinRoomAction } from './JoinRoomAction';

const at = (hour: number, minute = 0) => new Date(2026, 8, 23, hour, minute).getTime();

const reservation: Reservation = {
  id: 'reserva-1',
  employee: { id: 'usr-empleado-001', fullName: 'David Cajamarca' },
  startsAt: new Date(at(10)).toISOString(),
  endsAt: new Date(at(10, 50)).toISOString(),
  status: 'CONFIRMADA',
  joinOpensAt: new Date(at(9, 50)).toISOString(),
  joinClosesAt: new Date(at(10, 50)).toISOString(),
};

function renderAction(value: Reservation, now: number) {
  return render(
    <MemoryRouter>
      <JoinRoomAction reservation={value} now={now} />
    </MemoryRouter>,
  );
}

describe('JoinRoomAction', () => {
  it('lleva a la sala mientras la ventana de ingreso está abierta', () => {
    renderAction(reservation, at(9, 50));

    expect(
      screen.getByRole('link', { name: 'Entrar a la sala con David Cajamarca' }),
    ).toHaveAttribute('href', '/psicologo/agenda/sala/reserva-1');
  });

  it('deshabilita el ingreso antes de la ventana y dice cuándo abre', () => {
    renderAction(reservation, at(9, 30));

    const button = screen.getByRole('button', { name: 'Entrar a la sala' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('La sala abre a las 9:50');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('avisa cuando la sala ya cerró', () => {
    renderAction(reservation, at(10, 51));

    expect(screen.getByText('La sala de esta sesión ya cerró.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('no ofrece la sala para una reserva sin ventana de ingreso', () => {
    const { container } = renderAction(
      { ...reservation, status: 'CANCELADA', joinOpensAt: null, joinClosesAt: null },
      at(10),
    );

    expect(container).toBeEmptyDOMElement();
  });
});
