import { useState } from 'react';
import { useNow } from '@/shared/hooks/useNow';
import { Button } from '@/shared/ui/Button/Button';
import { AdminWorkshopList } from '../components/AdminWorkshopList';
import { CreateWorkshopForm } from '../components/CreateWorkshopForm';
import { useAdminWorkshops } from '../hooks/useAdminWorkshops';
import { hasStarted } from '../model/workshop';
import styles from './AdminWorkshopsPage.module.css';

const PLACEHOLDERS = ['uno', 'dos', 'tres'] as const;

function workshopsLabel(count: number): string {
  return count === 1
    ? '1 taller publicado en total'
    : `${String(count)} talleres publicados en total`;
}

/** Talleres del administrador: publicar uno con capacidad y ver los ya publicados (HU-FE-15). */
export function AdminWorkshopsPage() {
  const now = useNow();
  const [announcement, setAnnouncement] = useState('');
  const { status, workshops, retry, addWorkshop } = useAdminWorkshops({
    onRemotePublished: (workshop) => {
      setAnnouncement(`Se publicó el taller «${workshop.title}».`);
    },
  });
  const loaded = workshops.length > 0;
  const upcoming = workshops.filter((workshop) => !hasStarted(workshop, now));

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Talleres</h1>
        <p className={styles.subtitle}>
          Programa talleres con capacidad máxima y avisa a tus empleados al instante.
        </p>
      </header>

      <p className={styles.announcement} role="status" aria-label="Avisos de talleres">
        {announcement}
      </p>

      <div className={styles.layout}>
        <section
          className={styles.listCard}
          aria-labelledby="talleres-publicados"
          aria-busy={status === 'loading'}
        >
          <h2 id="talleres-publicados" className={styles.cardTitle}>
            Talleres publicados
          </h2>

          {status === 'error' && (
            <div className={styles.feedback} role="alert">
              <p>No pudimos cargar los talleres.</p>
              <Button variant="outline" onClick={retry}>
                Reintentar
              </Button>
            </div>
          )}

          {status === 'loading' && !loaded && (
            <ul className={styles.skeleton} aria-label="Cargando talleres" aria-busy="true">
              {PLACEHOLDERS.map((placeholder) => (
                <li key={placeholder} className={styles.skeletonRow} />
              ))}
            </ul>
          )}

          {status === 'ready' && !loaded && (
            <div className={styles.empty}>
              <h3 className={styles.emptyTitle}>Todavía no has publicado talleres</h3>
              <p>Completa el formulario y tu primer taller aparecerá aquí con su capacidad.</p>
            </div>
          )}

          {loaded && <AdminWorkshopList workshops={workshops} now={now} />}
        </section>

        <aside className={styles.side} aria-label="Gestión de talleres">
          <CreateWorkshopForm
            onPublished={(workshop) => {
              addWorkshop(workshop);
              setAnnouncement(`Publicaste el taller «${workshop.title}».`);
            }}
          />
          <section className={styles.card} aria-labelledby="resumen-talleres">
            <h2 id="resumen-talleres" className={styles.cardTitle}>
              Resumen
            </h2>
            <dl className={styles.summary}>
              <div>
                <dt>Próximos</dt>
                <dd>{upcoming.length}</dd>
              </div>
              <div>
                <dt>Realizados</dt>
                <dd>{workshops.length - upcoming.length}</dd>
              </div>
            </dl>
            <p className={styles.count}>{workshopsLabel(workshops.length)}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
