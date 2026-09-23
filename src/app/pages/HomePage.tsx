import type { Variants } from 'motion/react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import lockIcon from '@/assets/icons/lock.svg';
import hexagonSage from '@/assets/login/hexagon-2.svg';
import hexagonMauve from '@/assets/login/hexagon-4.svg';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { formatLongDate, getFirstName } from '@/shared/lib/text';
import { HexIcon } from '@/shared/ui/HexIcon/HexIcon';
import { ArrowRightIcon } from '@/shared/ui/icons';
import type { NavItem } from '../navigation';
import { NAVIGATION, ROLE_PROFILE } from '../navigation';
import { ROLE_HOME_PATH } from '../paths';
import styles from './HomePage.module.css';

const grid: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const card: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

/** Pantalla de llegada del rol: bienvenida con su garantía de privacidad y accesos a sus secciones. */
export function HomePage() {
  const user = useCurrentUser();
  const profile = ROLE_PROFILE[user.role];
  const sections = NAVIGATION[user.role].filter((item) => item.path !== ROLE_HOME_PATH[user.role]);

  return (
    <div className={styles.home}>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.heroDecoration} aria-hidden="true">
          <img
            className={styles.heroHexagonSage}
            src={hexagonSage}
            alt=""
            width={259.808}
            height={300}
          />
          <img
            className={styles.heroHexagonMauve}
            src={hexagonMauve}
            alt=""
            width={259.808}
            height={300}
          />
        </div>
        <p className={styles.date}>{formatLongDate(new Date())}</p>
        <h1 id="home-title" className={styles.title}>
          Hola, {getFirstName(user.fullName)}
        </h1>
        <p className={styles.welcome}>{profile.welcome}</p>
        <p className={styles.privacy}>
          <img src={lockIcon} alt="" width={18} height={18} />
          {profile.privacyNote}
        </p>
      </section>

      <section aria-labelledby="accesos-title">
        <h2 id="accesos-title" className={styles.sectionTitle}>
          Accesos rápidos
        </h2>
        <motion.ul className={styles.grid} variants={grid} initial="hidden" animate="visible">
          {sections.map((item) => (
            <QuickAccessCard key={item.path} item={item} />
          ))}
        </motion.ul>
      </section>
    </div>
  );
}

function QuickAccessCard({ item }: Readonly<{ item: NavItem }>) {
  return (
    <motion.li variants={card}>
      <motion.div className={styles.cardMotion} whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}>
        <Link to={item.path} className={styles.card}>
          <HexIcon src={item.icon} />
          <span className={styles.cardBody}>
            <span className={styles.cardTitle}>{item.label}</span>
            <span className={styles.cardDescription}>{item.description}</span>
          </span>
          <span className={styles.cardArrow}>
            <ArrowRightIcon />
          </span>
        </Link>
      </motion.div>
    </motion.li>
  );
}
