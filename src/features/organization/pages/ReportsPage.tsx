import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { useFetch } from '@/shared/hooks/useFetch';
import { useNow } from '@/shared/hooks/useNow';
import { Button } from '@/shared/ui/Button/Button';
import { LockIcon } from '@/shared/ui/icons';
import { fetchOrganizationOverview } from '../api/overviewApi';
import type { SpotsTotals } from '../model/report';
import { percentLabel, summarizeProjects, summarizeWorkshops } from '../model/report';
import styles from './OrganizationPages.module.css';

function SpotsMeter({ label, totals }: Readonly<{ label: string; totals: SpotsTotals }>) {
  return (
    <div className={styles.meter}>
      <progress value={totals.percent} max={100} aria-label={label} />
      <span>
        {totals.occupied} de {totals.capacity} cupos ocupados ({percentLabel(totals.percent)})
      </span>
    </div>
  );
}

/**
 * Reportes agregados de la empresa (vista del administrador): totales de personas, convocatorias y
 * talleres. Nunca muestra datos de una persona ni de su bienestar.
 */
export function ReportsPage() {
  const user = useCurrentUser();
  const { status, data, reload } = useFetch('reportes', fetchOrganizationOverview, {
    listing: true,
  });
  const now = useNow();
  useDocumentTitle('Reportes');

  function content() {
    if (data === null) {
      return status === 'error' ? (
        <div className={styles.feedback} role="alert">
          <p>No pudimos cargar los reportes.</p>
          <Button variant="outline" onClick={reload}>
            Reintentar
          </Button>
        </div>
      ) : (
        <p className={styles.feedback} aria-busy="true">
          Cargando los reportes…
        </p>
      );
    }
    const projects = summarizeProjects(data.projects, now);
    const workshops = summarizeWorkshops(data.workshops, now);
    return (
      <>
        <section className={styles.card} aria-labelledby="reporte-personas">
          <h2 id="reporte-personas" className={styles.cardTitle}>
            Personas
          </h2>
          <dl className={styles.stats}>
            <div className={styles.stat}>
              <dt>Con cuenta en ZEAL</dt>
              <dd>{data.employees.length}</dd>
            </div>
          </dl>
        </section>
        <section className={styles.card} aria-labelledby="reporte-convocatorias">
          <h2 id="reporte-convocatorias" className={styles.cardTitle}>
            Convocatorias
          </h2>
          <dl className={styles.stats}>
            <div className={styles.stat}>
              <dt>Publicadas</dt>
              <dd>{projects.published}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Abiertas</dt>
              <dd>{projects.open}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Cerradas</dt>
              <dd>{projects.closed}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Abiertas sin cupos</dt>
              <dd>{projects.full}</dd>
            </div>
          </dl>
          <SpotsMeter label="Cupos de convocatorias ocupados" totals={projects.spots} />
        </section>
        <section className={styles.card} aria-labelledby="reporte-talleres">
          <h2 id="reporte-talleres" className={styles.cardTitle}>
            Talleres
          </h2>
          <dl className={styles.stats}>
            <div className={styles.stat}>
              <dt>Programados</dt>
              <dd>{workshops.published}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Próximos</dt>
              <dd>{workshops.upcoming}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Ya realizados</dt>
              <dd>{workshops.held}</dd>
            </div>
          </dl>
          <SpotsMeter label="Cupos de talleres ocupados" totals={workshops.spots} />
        </section>
      </>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Reportes</h1>
        <p className={styles.subtitle}>Datos agregados de {user.organization}</p>
      </header>
      <p className={styles.privacy}>
        <LockIcon />
        Solo ves totales de tu empresa. Nunca datos individuales: las citas, mensajes y el bienestar
        de cada persona son confidenciales.
      </p>
      <div aria-live="polite" className={styles.page}>
        {content()}
      </div>
    </div>
  );
}
