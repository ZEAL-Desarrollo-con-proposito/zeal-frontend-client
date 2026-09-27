import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { EMPLOYEE_PATHS } from '@/app/paths';
import type { Slot } from '@/features/availability/model/slot';
import { SLOTS_TOPIC } from '@/features/availability/model/slotEvent';
import { publishMockEvent } from '@/mocks/realtime';
import { server } from '@/mocks/server';
import { readWellbeingDb, writeWellbeingDb } from '@/mocks/wellbeing/db';
import { freezeTime } from '@/test/clock';
import { storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import { PSYCHOLOGISTS_ENDPOINT } from '../api/directoryApi';

function openDirectory(search = '') {
  storeSession('EMPLEADO');
  return renderRoute(`${EMPLOYEE_PATHS.wellbeing}${search}`);
}

async function cards() {
  const results = await screen.findByRole('region', { name: 'Psicólogos del directorio' });
  return within(results).findAllByRole('listitem');
}

function card(name: string) {
  return within(screen.getByRole('listitem', { name }));
}

function names() {
  return screen
    .getAllByRole('heading', { level: 2 })
    .map((heading) => heading.textContent)
    .filter((text) => text !== 'Ningún psicólogo coincide con tu búsqueda');
}

function count() {
  return screen.getByRole('status', { name: 'Resultados del directorio' });
}

describe('Bienestar · directorio de psicólogos (HU-FE-04)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('muestra una tarjeta por psicólogo con su especialidad y su disponibilidad', async () => {
    openDirectory();

    expect(screen.getByRole('heading', { level: 1, name: 'Bienestar' })).toBeInTheDocument();
    expect(await cards()).toHaveLength(4);
    expect(names()).toEqual(['Laura Martínez', 'Andrés Rojas', 'Valeria Castro', 'Camila Duarte']);
    expect(count()).toHaveTextContent('4 psicólogos en el directorio');

    const laura = card('Laura Martínez');
    expect(laura.getByText('Psicóloga clínica')).toBeInTheDocument();
    expect(laura.getByText('Ansiedad laboral · Burnout')).toBeInTheDocument();
    expect(laura.getByText('Disponible hoy')).toBeInTheDocument();
    expect(laura.getByText(/Hoy · 10:00/)).toBeInTheDocument();
    expect(
      laura.getByRole('link', { name: 'Ver disponibilidad de Laura Martínez' }),
    ).toHaveAttribute('href', '/empleado/bienestar/psicologos/usr-psicologo-001');

    expect(card('Valeria Castro').getByText('Agenda llena')).toBeInTheDocument();
    expect(card('Valeria Castro').getByText(/Lun 28 · 9:00/)).toBeInTheDocument();
    expect(card('Camila Duarte').getByText('Sin bloques')).toBeInTheDocument();
    expect(card('Camila Duarte').getByText(/Aún no abre bloques/)).toBeInTheDocument();
  });

  it('reserva el espacio del directorio mientras carga', async () => {
    openDirectory();

    const results = screen.getByRole('region', { name: 'Psicólogos del directorio' });
    expect(results).toHaveAttribute('aria-busy', 'true');
    await cards();
    expect(results).toHaveAttribute('aria-busy', 'false');
  });

  it('busca por nombre o especialidad sin importar las tildes', async () => {
    const { router, user } = openDirectory();
    await cards();
    const search = screen.getByRole('searchbox', {
      name: 'Buscar psicólogo por nombre o especialidad',
    });

    await user.type(search, 'andres');

    await waitFor(() => {
      expect(names()).toEqual(['Andrés Rojas']);
    });
    expect(count()).toHaveTextContent('1 psicólogo de 4');
    expect(router.state.location.search).toBe('?q=andres');

    await user.clear(search);
    await user.type(search, 'clinica');
    await waitFor(() => {
      expect(names()).toEqual(['Laura Martínez', 'Valeria Castro']);
    });

    await user.click(screen.getByRole('button', { name: 'Borrar búsqueda' }));
    await waitFor(() => {
      expect(names()).toHaveLength(4);
    });
    expect(search).toHaveValue('');
    expect(search).toHaveFocus();
    expect(router.state.location.search).toBe('');
  });

  it('filtra por tema y por disponibilidad de hoy', async () => {
    const { router, user } = openDirectory();
    await cards();
    const topics = within(screen.getByRole('group', { name: 'Filtrar por tema' }));
    expect(topics.getAllByRole('button').map((chip) => chip.textContent)).toEqual([
      'Todos',
      'Ansiedad laboral',
      'Burnout',
      'Carrera',
      'Duelo',
      'Sueño',
    ]);

    await user.click(topics.getByRole('button', { name: 'Burnout' }));

    expect(topics.getByRole('button', { name: 'Burnout' })).toHaveAttribute('aria-pressed', 'true');
    expect(topics.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => {
      expect(names()).toEqual(['Laura Martínez', 'Andrés Rojas']);
    });

    await user.click(topics.getByRole('button', { name: 'Todos' }));
    const today = screen.getByRole('switch', { name: 'Disponible hoy' });
    await user.click(today);

    expect(today).toHaveAttribute('aria-checked', 'true');
    expect(router.state.location.search).toBe('?hoy=1');
    await waitFor(() => {
      expect(names()).toEqual(['Laura Martínez', 'Andrés Rojas']);
    });

    await user.click(today);
    expect(router.state.location.search).toBe('');
  });

  it('nunca deja un callejón sin salida cuando nadie coincide', async () => {
    const { router, user } = openDirectory('?tema=Duelo&hoy=1');
    await screen.findByRole('region', { name: 'Psicólogos del directorio' });

    expect(
      await screen.findByRole('heading', { name: 'Ningún psicólogo coincide con tu búsqueda' }),
    ).toBeInTheDocument();
    expect(count()).toHaveTextContent('0 psicólogos de 4');

    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    await waitFor(() => {
      expect(names()).toHaveLength(4);
    });
    expect(router.state.location.search).toBe('');
    expect(screen.getByRole('switch', { name: 'Disponible hoy' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('recupera los filtros de la URL al volver al directorio', async () => {
    openDirectory('?q=laura&tema=Burnout&hoy=1');

    await waitFor(() => {
      expect(names()).toEqual(['Laura Martínez']);
    });
    expect(screen.getByRole('searchbox')).toHaveValue('laura');
    expect(screen.getByRole('button', { name: 'Burnout' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('switch', { name: 'Disponible hoy' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('lleva al perfil conservando los filtros para el regreso', async () => {
    const { router, user } = openDirectory('?tema=Duelo');
    await cards();

    await user.click(screen.getByRole('link', { name: 'Ver disponibilidad de Valeria Castro' }));

    expect(router.state.location.pathname).toBe('/empleado/bienestar/psicologos/usr-psicologo-003');
    expect(router.state.location.state).toEqual({ directorySearch: '?tema=Duelo' });
  });

  it('lleva a Mis citas', async () => {
    const { router, user } = openDirectory();

    await user.click(within(screen.getByRole('main')).getByRole('link', { name: 'Mis citas' }));

    expect(router.state.location.pathname).toBe(EMPLOYEE_PATHS.appointments);
  });

  it('permite reintentar si el directorio no carga', async () => {
    server.use(
      http.get(`*${PSYCHOLOGISTS_ENDPOINT}`, () => new HttpResponse(null, { status: 500 }), {
        once: true,
      }),
    );
    const { user } = openDirectory();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos cargar el directorio.');

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(await cards()).toHaveLength(4);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('avisa si el directorio está vacío', async () => {
    server.use(http.get(`*${PSYCHOLOGISTS_ENDPOINT}`, () => HttpResponse.json([])));
    openDirectory();

    expect(await screen.findByText('Aún no hay psicólogos en el directorio.')).toBeInTheDocument();
  });

  it('actualiza la disponibilidad en vivo cuando un psicólogo abre un bloque', async () => {
    openDirectory();
    await cards();
    expect(card('Camila Duarte').getByText('Sin bloques')).toBeInTheDocument();

    // Camila abre un bloque para hoy desde su agenda (otra sesión, en otro dispositivo).
    const db = readWellbeingDb();
    const slot: Slot = {
      id: 'franja-camila',
      psychologistId: 'usr-psicologo-004',
      startsAt: new Date(2026, 8, 23, 9, 30).toISOString(),
      endsAt: new Date(2026, 8, 23, 10, 20).toISOString(),
      status: 'DISPONIBLE',
    };
    db.slots.push(slot);
    writeWellbeingDb(db);
    act(() => {
      publishMockEvent(SLOTS_TOPIC, { type: 'CREADA', slot });
    });

    await waitFor(() => {
      expect(card('Camila Duarte').getByText('Disponible hoy')).toBeInTheDocument();
    });
    expect(card('Camila Duarte').getByText(/Hoy · 9:30/)).toBeInTheDocument();
    // Ahora es quien tiene el bloque más próximo.
    expect(names()[0]).toBe('Camila Duarte');
  });
});
