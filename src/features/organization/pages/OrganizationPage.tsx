import { ADMIN_PATHS } from '@/app/paths';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { useFetch } from '@/shared/hooks/useFetch';
import { Button } from '@/shared/ui/Button/Button';
import { LinkButton } from '@/shared/ui/Button/LinkButton';
import { LockIcon } from '@/shared/ui/icons';
import { fetchOrganizationOverview } from '../api/overviewApi';
import { employeesCountLabel } from '../model/employee';
import styles from './OrganizationPages.module.css';

/**
 * La empresa en ZEAL (vista del administrador): quién es, quién la administra y qué tiene hoy
 * (personas, convocatorias y talleres), con acceso rápido a cada sección y a los reportes.
 */
export function OrganizationPage() {
  const user = useCurrentUser();
  const { status, data, reload } = useFetch('organizacion', fetchOrganizationOverview, {
    listing: true,
  });
  useDocumentTitle('Organización');

  function summary() {
    if (data === null) {
      return status === 'error' ? (
        <div className={styles.feedback} role="alert">
          <p>No pudimos cargar los datos de tu empresa.</p>
          <Button variant="outline" onClick={reload}>
            Reintentar
          </Button>
        </div>
      ) : (
        <p className={styles.feedback} aria-busy="true">
          Cargando los datos de tu empresa…
        </p>
      );
    }
    return (
      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>Personas con cuenta</dt>
          <dd>{data.employees.length}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Convocatorias publicadas</dt>
          <dd>{data.projects.length}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Talleres programados</dt>
          <dd>{data.workshops.length}</dd>
        </div>
      </dl>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Organización</h1>
        <p className={styles.subtitle}>
          Los datos de {user.organization}
          {data === null ? '' : ` · ${employeesCountLabel(data.employees.length)} en ZEAL`}
        </p>
      </header>
      <section className={styles.card} aria-labelledby="org-empresa">
        <h2 id="org-empresa" className={styles.cardTitle}>
          Tu empresa
        </h2>
        <dl className={styles.facts}>
          <div>
            <dt>Empresa</dt>
            <dd>{user.organization}</dd>
          </div>
          <div>
            <dt>Administra</dt>
            <dd>{user.fullName}</dd>
          </div>
          <div>
            <dt>Correo de la cuenta</dt>
            <dd>{user.email}</dd>
          </div>
        </dl>
      </section>
      <section className={styles.card} aria-labelledby="org-actividad" aria-live="polite">
        <h2 id="org-actividad" className={styles.cardTitle}>
          Lo que tienes en ZEAL
        </h2>
        {summary()}
        <div className={styles.links}>
          <LinkButton to={ADMIN_PATHS.employees} variant="outline">
            Ver empleados
          </LinkButton>
          <LinkButton to={ADMIN_PATHS.projects} variant="outline">
            Ver convocatorias
          </LinkButton>
          <LinkButton to={ADMIN_PATHS.workshops} variant="outline">
            Ver talleres
          </LinkButton>
          <LinkButton to={ADMIN_PATHS.reports}>Ver reportes</LinkButton>
        </div>
      </section>
      <section className={styles.card} aria-labelledby="org-privacidad">
        <h2 id="org-privacidad" className={styles.cardTitle}>
          Cómo se protege a las personas de tu empresa
        </h2>
        <p className={styles.privacy}>
          <LockIcon />
          Tu empresa solo ve datos de contacto y totales.
        </p>
        <ul className={styles.guarantees}>
          <li>Las citas, los mensajes y el bienestar de cada persona son confidenciales.</li>
          <li>Los reportes son agregados de tu organización, nunca individuales.</li>
          <li>Cada empresa solo accede a sus propios datos.</li>
        </ul>
      </section>
    </div>
  );
}
