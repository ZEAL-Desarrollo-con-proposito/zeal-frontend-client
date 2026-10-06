import { useState } from 'react';
import { useNow } from '@/shared/hooks/useNow';
import { Button } from '@/shared/ui/Button/Button';
import { AdminProjectList } from '../components/AdminProjectList';
import { CreateProjectForm } from '../components/CreateProjectForm';
import { useAdminProjects } from '../hooks/useAdminProjects';
import { closingOf } from '../model/project';
import styles from './AdminProjectsPage.module.css';

const PLACEHOLDERS = ['uno', 'dos', 'tres'] as const;

function projectsLabel(count: number): string {
  return count === 1
    ? '1 proyecto publicado en total'
    : `${String(count)} proyectos publicados en total`;
}

/** Proyectos del administrador: publicar uno con cupos y ver los ya publicados (HU-FE-14). */
export function AdminProjectsPage() {
  const now = useNow();
  const [announcement, setAnnouncement] = useState('');
  const { status, projects, retry, addProject } = useAdminProjects({
    onRemotePublished: (project) => {
      setAnnouncement(`Se publicó el proyecto «${project.title}».`);
    },
  });
  const loaded = projects.length > 0;
  const open = projects.filter((project) => !closingOf(project.closesAt, now).closed);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Proyectos</h1>
        <p className={styles.subtitle}>
          Publica convocatorias internas con cupos limitados y sigue cuántos quedan.
        </p>
      </header>

      <p className={styles.announcement} role="status" aria-label="Avisos de proyectos">
        {announcement}
      </p>

      <div className={styles.layout}>
        <section
          className={styles.listCard}
          aria-labelledby="proyectos-publicados"
          aria-busy={status === 'loading'}
        >
          <h2 id="proyectos-publicados" className={styles.cardTitle}>
            Proyectos publicados
          </h2>

          {status === 'error' && (
            <div className={styles.feedback} role="alert">
              <p>No pudimos cargar los proyectos.</p>
              <Button variant="outline" onClick={retry}>
                Reintentar
              </Button>
            </div>
          )}

          {status === 'loading' && !loaded && (
            <ul className={styles.skeleton} aria-label="Cargando proyectos" aria-busy="true">
              {PLACEHOLDERS.map((placeholder) => (
                <li key={placeholder} className={styles.skeletonRow} />
              ))}
            </ul>
          )}

          {status === 'ready' && !loaded && (
            <div className={styles.empty}>
              <h3 className={styles.emptyTitle}>Todavía no has publicado proyectos</h3>
              <p>Completa el formulario y tu primer proyecto aparecerá aquí con sus cupos.</p>
            </div>
          )}

          {loaded && <AdminProjectList projects={projects} now={now} />}
        </section>

        <aside className={styles.side} aria-label="Gestión de proyectos">
          <CreateProjectForm
            onPublished={(project) => {
              addProject(project);
              setAnnouncement(`Publicaste el proyecto «${project.title}».`);
            }}
          />
          <section className={styles.card} aria-labelledby="resumen-proyectos">
            <h2 id="resumen-proyectos" className={styles.cardTitle}>
              Resumen
            </h2>
            <dl className={styles.summary}>
              <div>
                <dt>Abiertos</dt>
                <dd>{open.length}</dd>
              </div>
              <div>
                <dt>Cerrados</dt>
                <dd>{projects.length - open.length}</dd>
              </div>
            </dl>
            <p className={styles.count}>{projectsLabel(projects.length)}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
