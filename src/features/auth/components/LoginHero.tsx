import { motion } from 'motion/react';
import checkIcon from '@/assets/icons/check.svg';
import hexagonTeal from '@/assets/login/hexagon-1.svg';
import hexagonSage from '@/assets/login/hexagon-2.svg';
import hexagonMist from '@/assets/login/hexagon-3.svg';
import hexagonMauve from '@/assets/login/hexagon-4.svg';
import { cx } from '@/shared/lib/cx';
import styles from './LoginHero.module.css';

const HEXAGONS = [
  { src: hexagonTeal, positionClass: styles.hexagonTeal, driftPx: 10, durationS: 9 },
  { src: hexagonSage, positionClass: styles.hexagonSage, driftPx: 14, durationS: 11 },
  { src: hexagonMist, positionClass: styles.hexagonMist, driftPx: 12, durationS: 13 },
  { src: hexagonMauve, positionClass: styles.hexagonMauve, driftPx: 16, durationS: 10 },
];

const VALUE_PROPOSITIONS = [
  'Acompañamiento emocional 100% confidencial',
  'Talleres comunitarios en vivo y en comunidad',
  'Tu ZEAL Path: desarrollo profesional acelerado',
];

/** Panel de marca del login (Figma A1 · Hero). Los hexágonos evocan comunidad, no videollamada corporativa. */
export function LoginHero() {
  return (
    <aside className={styles.hero} aria-label="Sobre ZEAL">
      <div className={styles.decoration} aria-hidden="true">
        {HEXAGONS.map(({ src, positionClass, driftPx, durationS }) => (
          <motion.div
            key={src}
            className={cx(styles.hexagon, positionClass)}
            animate={{ y: [0, -driftPx, 0] }}
            transition={{ duration: durationS, repeat: Infinity, ease: 'easeInOut' }}
          >
            <img className={styles.hexagonImage} src={src} alt="" width={259.808} height={300} />
          </motion.div>
        ))}
      </div>

      <motion.div
        className={styles.copy}
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <p className={styles.wordmark}>ZEAL</p>
        <p className={styles.tagline}>Cuidado de la salud mental en el trabajo</p>
        <ul className={styles.propositions}>
          {VALUE_PROPOSITIONS.map((proposition) => (
            <li key={proposition} className={styles.proposition}>
              <img src={checkIcon} alt="" width={20} height={20} />
              {proposition}
            </li>
          ))}
        </ul>
      </motion.div>

      <p className={styles.footer}>Escuela Colombiana de Ingeniería Julio Garavito · 2026-2</p>
    </aside>
  );
}
