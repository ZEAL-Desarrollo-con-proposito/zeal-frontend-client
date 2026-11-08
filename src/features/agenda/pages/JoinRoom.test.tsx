import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PSYCHOLOGIST_PATHS, sessionRoomPath } from '@/app/paths';
import { controlClock, freezeTime, jumpTo } from '@/test/clock';
import { storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';

const TODAY = 'Hoy · Miércoles, 23 de septiembre';
const JOIN_DAVID = 'Entrar a la sala con David Cajamarca';
const wednesdayAt = (hour: number, minute = 0) => new Date(2026, 8, 23, hour, minute);

async function openAs(path: string) {
  storeSession('PSICOLOGO');
  return await renderRoute(path);
}

function nextSessionCard() {
  return within(screen.getByRole('region', { name: 'Próxima sesión' }));
}

async function rowAt(time: string) {
  const today = within(await screen.findByRole('region', { name: TODAY }));
  const item = today.getByText(time).closest('li');
  if (item === null) {
    throw new Error(`No hay reserva a las ${time}`);
  }
  return within(item);
}

describe('Entrar a la sala desde la agenda (HU-FE-03)', () => {
  it('ofrece entrar a la sala de la sesión en curso, desde la tarjeta y desde su fila', async () => {
    freezeTime();
    const { router, user } = await openAs(PSYCHOLOGIST_PATHS.agenda);

    const inProgress = await rowAt('9:00 – 9:50');
    expect(inProgress.getByRole('link', { name: JOIN_DAVID })).toHaveAttribute(
      'href',
      sessionRoomPath('reserva-16'),
    );
    expect((await rowAt('11:00 – 11:50')).queryByRole('link')).not.toBeInTheDocument();

    await user.click(nextSessionCard().getByRole('link', { name: JOIN_DAVID }));

    // La sala va a pantalla completa (Figma C2): sin barra lateral, con su propia salida.
    expect(router.state.location.pathname).toBe('/psicologo/agenda/sala/reserva-16');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sesión 1:1 · David Cajamarca' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Navegación principal' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a mi agenda' })).toHaveAttribute(
      'href',
      PSYCHOLOGIST_PATHS.agenda,
    );
    expect(document.title).toBe('Sala de sesión · ZEAL');
  });

  it('habilita el botón por sí solo cuando se abre la ventana de ingreso', async () => {
    controlClock(wednesdayAt(9, 55));
    await openAs(PSYCHOLOGIST_PATHS.agenda);

    const button = await screen.findByRole('button', { name: 'Entrar a la sala' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('La sala abre a las 10:50');

    jumpTo(wednesdayAt(10, 50));

    expect(await nextSessionCard().findByRole('link', { name: JOIN_DAVID })).toBeInTheDocument();
    expect((await rowAt('11:00 – 11:50')).getByRole('link')).toBeInTheDocument();
  });
});
