import { motion } from 'motion/react';
import { EMPLOYEE_PATHS } from '@/app/paths';
import { LinkButton } from '@/shared/ui/Button/LinkButton';
import styles from './NoAppointments.module.css';

interface NoAppointmentsProps {
  organization: string;
}

const STEPS = [
  {
    title: 'Elige con quién',
    detail: 'Cada profesional muestra su enfoque y sus temas. No hay asignación automática.',
  },
  {
    title: 'Reserva un bloque',
    detail: 'Sesiones 1:1 de 50 minutos por videollamada, en el horario que te sirva.',
  },
  {
    title: 'Habla tranquilo',
    detail: 'La sesión es privada: nada de lo que digas llega a tu empresa.',
  },
] as const;

/** Figma F1 · "Todavía no tienes citas": el estado vacío lleva al directorio y explica cómo empezar. */
export function NoAppointments({ organization }: Readonly<NoAppointmentsProps>) {
  return (
    <motion.section
      className={styles.empty}
      aria-labelledby="sin-citas"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <div className={styles.intro}>
        <h2 id="sin-citas" className={styles.title}>
          Todavía no tienes citas
        </h2>
        <p>
          Cuando reserves con un profesional, tu cita aparecerá aquí. Nadie en {organization} verá
          que la agendaste.
        </p>
        <LinkButton to={EMPLOYEE_PATHS.wellbeing}>Ver profesionales</LinkButton>
      </div>
      <ol className={styles.steps} aria-label="Cómo empezar">
        {STEPS.map((step, index) => (
          <li key={step.title} className={styles.step}>
            <span className={styles.number} aria-hidden="true">
              {index + 1}
            </span>
            <span>
              <strong className={styles.stepTitle}>{step.title}</strong>
              <span className={styles.stepDetail}>{step.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </motion.section>
  );
}
