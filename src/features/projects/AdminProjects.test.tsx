import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_PATHS } from '@/app/paths';
import {
  PROJECTS_DB_KEY,
  readProjectsDb,
  updateOccupiedSpots,
  writeProjectsDb,
} from '@/mocks/projects/db';
import { publishToUser } from '@/mocks/realtime';
import { server } from '@/mocks/server';
import { freezeTime } from '@/test/clock';
import { buildSession, seedUser, storeSession } from '@/test/credentials';
import { controlledRealtimeClient } from '@/test/realtime';
import { renderRoute } from '@/test/renderRoute';
import { ADMIN_PROJECTS_ENDPOINT } from './api/adminProjectsApi';
import type { AdminProject } from './model/adminProject';
import { PROJECTS_QUEUE } from './model/adminProjectEvent';

const list = () => within(screen.getByRole('list', { name: 'Proyectos publicados' }));
const form = () => within(screen.getByRole('region', { name: 'Publicar proyecto' }));
const announcements = () => screen.getByRole('status', { name: 'Avisos de proyectos' });
const cardOf = (title: string) => within(list().getByRole('listitem', { name: title }));

type View = ReturnType<typeof renderRoute>;

async function openProjects() {
  storeSession('ADMIN');
  const view = renderRoute(ADMIN_PATHS.projects);
  await screen.findByRole('list', { name: 'Proyectos publicados' });
  return view;
}

async function fillForm(user: View['user'], values: Partial<Record<string, string>> = {}) {
  const f = form();
  const data = {
    'Título del proyecto': 'Taller de innovación abierta',
    Área: 'Innovación',
    Cohorte: 'Semilla 2026-3',
    'Resumen para el catálogo': 'Explorar ideas nuevas con equipos de toda la empresa.',
    Descripción: 'Equipo para explorar ideas nuevas en la empresa.\n\nSe reúne cada semana.',
    'Requisitos (opcional)': 'Experiencia previa en producto',
    'Habilidades (opcional)': '',
    'Cupos disponibles': '4',
    'Fecha límite para postularse': '2026-10-30',
    ...values,
  };
  for (const [label, value] of Object.entries(data)) {
    if (value === '') continue;
    const field = f.getByLabelText(label);
    if (field.tagName === 'TEXTAREA') {
      await user.click(field);
      await user.paste(value);
    } else {
      await user.type(field, value);
    }
  }
}

const publish = (user: View['user']) =>
  user.click(form().getByRole('button', { name: 'Publicar proyecto' }));

describe('Proyectos del administrador · lista (HU-FE-14)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('muestra solo los proyectos de su empresa, con estado, cupos y cierre', async () => {
    await openProjects();

    const items = list().getAllByRole('listitem');
    expect(items).toHaveLength(5);
    const observabilidad = cardOf('Squad de Observabilidad');
    expect(observabilidad.getByText('Sin cupos')).toBeInTheDocument();
    expect(observabilidad.getByText('Plataforma · Semilla 2026-2')).toBeInTheDocument();
    expect(cardOf('Data Platform · Turno de guardia').getByText('Abierta')).toBeInTheDocument();
    expect(
      cardOf('Data Platform · Turno de guardia').getByText('Quedan 2 de 4 cupos'),
    ).toBeInTheDocument();
    expect(cardOf('Piloto de mentorías cruzadas').getByText('Cerrada')).toBeInTheDocument();
    expect(items[0]).toHaveTextContent('Squad de Observabilidad');
    expect(screen.queryByText('Proyecto de otra empresa')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Resumen' })).toHaveTextContent('Abiertos4');
  });

  it('explica el estado vacío', async () => {
    const db = JSON.parse(localStorage.getItem(PROJECTS_DB_KEY) ?? 'null') as {
      projects: unknown[];
    } | null;
    localStorage.setItem(
      PROJECTS_DB_KEY,
      JSON.stringify({ ...(db ?? {}), projects: [], applications: [], sequence: 0 }),
    );
    storeSession('ADMIN');
    renderRoute(ADMIN_PATHS.projects);

    expect(await screen.findByText('Todavía no has publicado proyectos')).toBeInTheDocument();
  });

  it('permite reintentar si la carga falla', async () => {
    server.use(http.get(`*${ADMIN_PROJECTS_ENDPOINT}`, () => HttpResponse.error(), { once: true }));
    storeSession('ADMIN');
    const { user } = renderRoute(ADMIN_PATHS.projects);

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar los proyectos.');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('list', { name: 'Proyectos publicados' })).toBeInTheDocument();
  });

  it('un empleado no accede a la pantalla de proyectos del administrador', () => {
    storeSession('EMPLEADO');
    renderRoute(ADMIN_PATHS.projects);

    expect(screen.queryByRole('region', { name: 'Publicar proyecto' })).not.toBeInTheDocument();
  });

  it('si el servidor responde 403, la pantalla se reemplaza por "Permiso denegado"', async () => {
    server.use(
      http.get(`*${ADMIN_PROJECTS_ENDPOINT}`, () =>
        HttpResponse.json(
          { status: 403, error: 'Forbidden', message: 'No tienes permiso para esta operación.' },
          { status: 403 },
        ),
      ),
    );
    storeSession('ADMIN');
    renderRoute(ADMIN_PATHS.projects);

    expect(
      await screen.findByRole('heading', { name: 'Esta sección no está disponible para tu rol' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Publicar proyecto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
  });

  it('resume con singular cuando solo hay un proyecto publicado', async () => {
    const db = readProjectsDb();
    writeProjectsDb({ ...db, projects: db.projects.slice(0, 1) });
    storeSession('ADMIN');
    renderRoute(ADMIN_PATHS.projects);

    expect(await screen.findByText('1 proyecto publicado en total')).toBeInTheDocument();
    expect(list().getAllByRole('listitem')).toHaveLength(1);
  });
});

describe('Proyectos del administrador · publicar (HU-FE-14)', () => {
  beforeEach(() => {
    freezeTime();
  });

  afterEach(() => {
    server.events.removeAllListeners();
  });

  it('valida los campos obligatorios, no envía y enfoca el primero inválido', async () => {
    const { user } = await openProjects();

    await publish(user);

    expect(form().getByLabelText('Título del proyecto')).toHaveAccessibleDescription(
      'Escribe el título del proyecto',
    );
    expect(form().getByLabelText('Área')).toHaveAccessibleDescription(
      'Indica el área del proyecto',
    );
    expect(form().getByLabelText('Cupos disponibles')).toHaveAccessibleDescription(
      'Indica cuántos cupos ofrece el proyecto',
    );
    expect(form().getByLabelText('Título del proyecto')).toHaveFocus();
    expect(form().getByLabelText('Requisitos (opcional)')).not.toBeInvalid();
    expect(list().getAllByRole('listitem')).toHaveLength(5);
  });

  it.each([
    ['0', 'El proyecto necesita al menos 1 cupo'],
    ['2.5', 'Los cupos deben ser un número entero'],
    ['500', 'El máximo es 100 cupos por proyecto'],
  ])('explica la capacidad inválida %j al salir del campo', async (capacity, message) => {
    const { user } = await openProjects();

    await user.type(form().getByLabelText('Cupos disponibles'), capacity);
    await user.tab();

    expect(form().getByLabelText('Cupos disponibles')).toHaveAccessibleDescription(message);
  });

  it('publica el proyecto: aparece primero, se anuncia y se limpia el formulario', async () => {
    const { user } = await openProjects();
    await fillForm(user, { 'Habilidades (opcional)': 'Facilitación de talleres' });

    await publish(user);

    await waitFor(() => {
      expect(list().getAllByRole('listitem')[0]).toHaveTextContent('Taller de innovación abierta');
    });
    expect(list().getAllByRole('listitem')).toHaveLength(6);
    const created = cardOf('Taller de innovación abierta');
    expect(created.getByText('Innovación · Semilla 2026-3')).toBeInTheDocument();
    expect(created.getByText('Quedan 4 de 4 cupos')).toBeInTheDocument();
    expect(announcements()).toHaveTextContent(
      'Publicaste el proyecto «Taller de innovación abierta».',
    );
    expect(form().getByLabelText('Título del proyecto')).toHaveValue('');
    expect(form().queryByRole('alert')).not.toBeInTheDocument();
  });

  it('muestra el rechazo del servidor y conserva lo escrito', async () => {
    const { user } = await openProjects();
    await fillForm(user, { 'Título del proyecto': 'Squad de Observabilidad' });

    await publish(user);

    expect(await form().findByRole('alert')).toHaveTextContent(
      'Ya tienes un proyecto abierto con ese título',
    );
    expect(form().getByLabelText('Cupos disponibles')).toHaveValue('4');
    expect(list().getAllByRole('listitem')).toHaveLength(5);
  });

  it('avisa si no hay conexión y bloquea el botón mientras envía', async () => {
    let release: () => void = () => undefined;
    server.use(
      http.post(`*${ADMIN_PROJECTS_ENDPOINT}`, async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return HttpResponse.error();
      }),
    );
    const { user } = await openProjects();
    await fillForm(user);

    await publish(user);

    expect(form().getByRole('button', { name: 'Publicando…' })).toBeDisabled();
    release();
    expect(await form().findByRole('alert')).toHaveTextContent(
      'No pudimos conectar con ZEAL. Revisa tu conexión e intenta de nuevo.',
    );
  });

  it('no reenvía mientras la primera publicación sigue en curso', async () => {
    const released: (() => void)[] = [];
    server.use(
      http.post(`*${ADMIN_PROJECTS_ENDPOINT}`, async () => {
        await new Promise<void>((resolve) => {
          released.push(resolve);
        });
        return HttpResponse.error();
      }),
    );
    const posts: string[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST') {
        posts.push(new URL(request.url).pathname);
      }
    });
    const { user } = await openProjects();
    await fillForm(user);

    await publish(user);

    expect(form().getByRole('button', { name: 'Publicando…' })).toBeDisabled();
    const formElement = screen
      .getByRole('region', { name: 'Publicar proyecto' })
      .getElementsByTagName('form')[0];
    if (formElement === undefined) {
      throw new Error('El formulario de publicación no está en pantalla');
    }
    fireEvent.submit(formElement);
    released.forEach((resolve) => {
      resolve();
    });

    expect(await form().findByRole('alert')).toHaveTextContent(
      'No pudimos conectar con ZEAL. Revisa tu conexión e intenta de nuevo.',
    );
    expect(posts).toHaveLength(1);
    expect(list().getAllByRole('listitem')).toHaveLength(5);
  });
});

describe('Proyectos del administrador · en tiempo real', () => {
  beforeEach(() => {
    freezeTime();
  });

  const remote: AdminProject = {
    id: 'proyecto-50',
    title: 'Publicado desde otra sesión',
    area: 'Datos',
    cohort: 'Semilla 2026-3',
    summary: 'Lo publicó otro administrador de la empresa.',
    capacity: 3,
    occupied: 0,
    version: 1,
    closesAt: new Date(2026, 9, 20, 23, 59, 59).toISOString(),
    publishedAt: new Date(2026, 8, 23, 9, 19).toISOString(),
  };

  it('muestra al instante un proyecto publicado desde otra sesión y lo anuncia', async () => {
    await openProjects();

    act(() => {
      publishToUser(seedUser('ADMIN').id, PROJECTS_QUEUE, { type: 'PUBLICADO', project: remote });
    });

    expect(await list().findByText('Publicado desde otra sesión')).toBeInTheDocument();
    expect(announcements()).toHaveTextContent(
      'Se publicó el proyecto «Publicado desde otra sesión».',
    );
  });

  it('los cupos de cada tarjeta cambian en vivo cuando alguien se postula', async () => {
    await openProjects();
    const guardia = cardOf('Data Platform · Turno de guardia');
    expect(guardia.getByText('Quedan 2 de 4 cupos')).toBeInTheDocument();

    act(() => {
      updateOccupiedSpots('proyecto-guardia-datos', 4);
    });

    // El aviso viaja por un canal asíncrono: con la suite entera en paralelo puede tardar más de 1 s.
    expect(
      await guardia.findByText('Sin cupos · 4 de 4 ocupados', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    await waitFor(
      () => {
        expect(guardia.getByText('Sin cupos')).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it('ignora mensajes mal formados y no duplica lo que publicó esta sesión', async () => {
    const { user } = await openProjects();
    act(() => {
      publishToUser(seedUser('ADMIN').id, PROJECTS_QUEUE, {
        type: 'PUBLICADO',
        project: { id: 'x' },
      });
    });
    await fillForm(user);
    await publish(user);
    await list().findByText('Taller de innovación abierta');

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(list().getAllByRole('listitem')).toHaveLength(6);
    expect(announcements()).toHaveTextContent('Publicaste el proyecto');
  });

  it('vuelve a pedir la lista al recuperar la conexión', async () => {
    const { client, store } = controlledRealtimeClient();
    storeSession('ADMIN');
    renderRoute(ADMIN_PATHS.projects, () => client);
    await screen.findByRole('list', { name: 'Proyectos publicados' });

    // Mientras no había conexión otra sesión publicó un proyecto y el aviso se perdió.
    await fetch(new URL(ADMIN_PROJECTS_ENDPOINT, window.location.origin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buildSession('ADMIN').accessToken}`,
      },
      body: JSON.stringify({
        title: 'Publicado sin conexión',
        area: 'Datos',
        cohort: 'Semilla 2026-3',
        summary: 'Se publicó mientras la conexión estaba caída.',
        description: ['Se publicó mientras la conexión estaba caída.'],
        requirements: [],
        skills: [],
        capacity: 2,
        closesAt: new Date(2026, 9, 30).toISOString(),
      }),
    });
    act(() => {
      store.set('reconnecting');
    });
    act(() => {
      store.set('connected');
    });

    expect(await list().findByText('Publicado sin conexión')).toBeInTheDocument();
  });
});
