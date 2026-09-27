import { useDeferredValue } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocation } from 'react-router';
import type { DirectoryReturnState } from '@/app/paths';
import { EMPLOYEE_PATHS } from '@/app/paths';
import { useNow } from '@/shared/hooks/useNow';
import { Button } from '@/shared/ui/Button/Button';
import { LinkButton } from '@/shared/ui/Button/LinkButton';
import { SearchField } from '@/shared/ui/SearchField/SearchField';
import { Switch } from '@/shared/ui/Switch/Switch';
import { DirectorySkeleton } from '../components/DirectorySkeleton';
import { PsychologistCard } from '../components/PsychologistCard';
import { TopicFilter } from '../components/TopicFilter';
import { useDirectory } from '../hooks/useDirectory';
import { useDirectoryFilters } from '../hooks/useDirectoryFilters';
import { filterDirectory, hasFilters, topicsOf } from '../model/psychologist';
import styles from './DirectoryPage.module.css';

function psychologistsLabel(count: number): string {
  return count === 1 ? '1 psicólogo' : `${String(count)} psicólogos`;
}

/** Figma B2 · Bienestar — directorio de psicólogos para el empleado (HU-FE-04). */
export function DirectoryPage() {
  const now = useNow();
  const { search } = useLocation();
  const { status, psychologists, reload } = useDirectory();
  const { filters, setQuery, setTopic, setOnlyToday, clear } = useDirectoryFilters();
  // La lista se filtra con un leve retraso: escribir nunca se siente trabado.
  const query = useDeferredValue(filters.query);
  const visible = filterDirectory(psychologists, { ...filters, query }, now);
  const filtered = hasFilters(filters);
  const returnState: DirectoryReturnState = { directorySearch: search };
  const loaded = psychologists.length > 0;

  return (
    <div className={styles.page}>
      <motion.header
        className={styles.head}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <div className={styles.headText}>
          <h1 className={styles.title}>Bienestar</h1>
          <p className={styles.subtitle}>
            Acompañamiento confidencial. Tu empresa nunca ve con quién hablas ni de qué hablan.
          </p>
        </div>
        <LinkButton to={EMPLOYEE_PATHS.appointments} variant="outline">
          Mis citas
        </LinkButton>
      </motion.header>

      <section className={styles.toolbar} aria-label="Filtros del directorio">
        <div className={styles.search}>
          <SearchField
            label="Buscar psicólogo por nombre o especialidad"
            placeholder="Buscar por nombre o especialidad"
            value={filters.query}
            onChange={setQuery}
          />
        </div>
        <TopicFilter
          topics={topicsOf(psychologists)}
          selected={filters.topic}
          onChange={setTopic}
        />
        <div className={styles.today}>
          <Switch label="Disponible hoy" checked={filters.onlyToday} onChange={setOnlyToday} />
        </div>
      </section>

      <section
        className={styles.results}
        aria-label="Psicólogos del directorio"
        aria-busy={status === 'loading'}
      >
        {status === 'error' && (
          <div className={styles.feedback} role="alert">
            <p>No pudimos cargar el directorio.</p>
            <Button variant="outline" onClick={reload}>
              Reintentar
            </Button>
          </div>
        )}
        {status === 'loading' && !loaded && <DirectorySkeleton />}
        {status === 'ready' && !loaded && (
          <p className={styles.feedback}>Aún no hay psicólogos en el directorio.</p>
        )}

        {loaded && (
          <>
            <p className={styles.count} role="status" aria-label="Resultados del directorio">
              {filtered
                ? `${psychologistsLabel(visible.length)} de ${String(psychologists.length)}`
                : `${psychologistsLabel(psychologists.length)} en el directorio`}
            </p>
            <ul className={styles.grid}>
              <AnimatePresence mode="popLayout">
                {visible.map((psychologist, index) => (
                  <PsychologistCard
                    key={psychologist.id}
                    psychologist={psychologist}
                    now={now}
                    index={index}
                    returnState={returnState}
                  />
                ))}
              </AnimatePresence>
            </ul>
            {visible.length === 0 && (
              <motion.div
                className={styles.noResults}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <h2 className={styles.noResultsTitle}>Ningún psicólogo coincide con tu búsqueda</h2>
                <p>Prueba con otro nombre o tema, o quita el filtro de disponibilidad de hoy.</p>
                <Button variant="outline" onClick={clear}>
                  Limpiar filtros
                </Button>
              </motion.div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
