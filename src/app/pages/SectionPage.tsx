import styles from './PageHeading.module.css';

interface SectionPageProps {
  title: string;
}

/** Sección del menú cuya pantalla llega con su propia historia de usuario. */
export function SectionPage({ title }: Readonly<SectionPageProps>) {
  return (
    <section className={styles.heading} aria-labelledby="section-title">
      <h1 id="section-title" className={styles.title}>
        {title}
      </h1>
      <p className={styles.subtitle}>Esta sección se habilita con su historia de usuario.</p>
    </section>
  );
}
