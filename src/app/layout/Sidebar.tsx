import { LayoutGroup, motion } from 'motion/react';
import { NavLink } from 'react-router';
import { LogoutButton } from '@/features/auth/components/LogoutButton';
import type { AuthUser } from '@/features/auth/model/session';
import { cx } from '@/shared/lib/cx';
import { Avatar } from '@/shared/ui/Avatar/Avatar';
import { NAVIGATION, ROLE_PROFILE } from '../navigation';
import styles from './Sidebar.module.css';

interface SidebarProps {
  user: AuthUser;
  /** Separa la animación del indicador activo entre la barra fija y el menú móvil. */
  layoutGroupId: string;
  onNavigate?: () => void;
}

/** Barra lateral de marca con el menú del rol (Figma: Nav / Empleado, Psicologo y Admin). */
export function Sidebar({ user, layoutGroupId, onNavigate }: Readonly<SidebarProps>) {
  const profile = ROLE_PROFILE[user.role];

  return (
    <div className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.wordmark}>ZEAL</span>
        <span className={styles.tagline}>Bienestar + Carrera</span>
      </div>

      <nav aria-label="Navegación principal">
        <LayoutGroup id={layoutGroupId}>
          <ul className={styles.items}>
            {NAVIGATION[user.role].map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end
                  onClick={onNavigate}
                  className={({ isActive }) => cx(styles.link, isActive && styles.active)}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          layoutId="active-indicator"
                          className={styles.indicator}
                          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                        />
                      )}
                      <img className={styles.icon} src={item.icon} alt="" width={20} height={20} />
                      <span className={styles.label}>{item.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </LayoutGroup>
      </nav>

      <div className={styles.footer}>
        <div className={styles.user}>
          <Avatar name={user.fullName} tone={profile.avatarTone} />
          <div className={styles.identity}>
            <span className={styles.name}>{user.fullName}</span>
            <span className={styles.detail}>
              {user.organization} · {profile.label}
            </span>
          </div>
        </div>
        <LogoutButton />
      </div>
    </div>
  );
}
