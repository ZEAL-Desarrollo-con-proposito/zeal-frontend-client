import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { useFetch } from '@/shared/hooks/useFetch';
import { Avatar } from '@/shared/ui/Avatar/Avatar';
import { Button } from '@/shared/ui/Button/Button';
import { LockIcon } from '@/shared/ui/icons';
import { SearchField } from '@/shared/ui/SearchField/SearchField';
import { fetchEmployees } from '../api/employeesApi';
import { employeesCountLabel, filterEmployees } from '../model/employee';
import styles from './EmployeesPage.module.css';

/**
 * Empleados de la empresa (vista del administrador): quiénes de su organización tienen cuenta en
 * ZEAL, con su correo. Por confidencialidad no muestra nada de su bienestar ni de su actividad.
 */
export function EmployeesPage() {
  const user = useCurrentUser();
  const [query, setQuery] = useState('');
  const { status, data, reload } = useFetch('empleados', fetchEmployees);
  useDocumentTitle('Empleados');
  const visible = data === null ? [] : filterEmployees(data, query);

  function content() {
    if (data === null) {
      return status === 'error' ? (
        <div className={styles.feedback} role="alert">
          <p>No pudimos cargar a tus empleados.</p>
          <Button variant="outline" onClick={reload}>
            Reintentar
          </Button>
        </div>
      ) : (
        <p className={styles.feedback} aria-busy="true">
          Cargando a tus empleados…
        </p>
      );
    }
    if (visible.length === 0) {
      return (
        <p className={styles.feedback}>
          {data.length === 0
            ? 'Aún no hay empleados de tu empresa en ZEAL.'
            : `Nadie coincide con «${query.trim()}».`}
        </p>
      );
    }
    return (
      <ul className={styles.list} aria-label="Empleados de la empresa">
        <AnimatePresence initial={false}>
          {visible.map((employee, index) => (
            <motion.li
              key={employee.id}
              layout
              className={styles.item}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, delay: Math.min(index, 8) * 0.03 }}
            >
              <Avatar name={employee.fullName} tone={index % 2 === 0 ? 'sage' : 'teal'} />
              <div className={styles.body}>
                <p className={styles.name}>{employee.fullName}</p>
                <a className={styles.email} href={`mailto:${employee.email}`}>
                  {employee.email}
                </a>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Empleados</h1>
        <p className={styles.subtitle}>
          Personas de {user.organization} con cuenta en ZEAL
          {data === null ? '' : ` · ${employeesCountLabel(data.length)}`}
        </p>
      </header>
      <p className={styles.privacy}>
        <LockIcon />
        Solo ves datos de contacto. Las citas, mensajes y el bienestar de cada persona son
        confidenciales.
      </p>
      <SearchField
        label="Buscar empleados"
        placeholder="Buscar por nombre o correo"
        value={query}
        onChange={setQuery}
      />
      <section aria-label="Directorio" aria-live="polite">
        {content()}
      </section>
    </div>
  );
}
