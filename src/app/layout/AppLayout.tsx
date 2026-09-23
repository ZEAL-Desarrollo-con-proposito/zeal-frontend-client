import type { PanInfo } from 'motion/react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { Avatar } from '@/shared/ui/Avatar/Avatar';
import { ROLE_PROFILE } from '../navigation';
import { isDismissGesture } from './drawerGesture';
import { Sidebar } from './Sidebar';
import styles from './AppLayout.module.css';

const MOBILE_MENU_ID = 'menu-movil';

/** Estructura de las pantallas con sesión: barra lateral por rol, barra superior y contenido. */
export function AppLayout() {
  const user = useCurrentUser();
  const { pathname } = useLocation();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  function openMenu() {
    setMenuOpen(true);
  }

  /** Cierre explícito (Escape, fondo, botón o gesto): el foco vuelve al botón que abrió el menú. */
  const dismissMenu = useCallback(() => {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  function closeMenuAfterNavigation() {
    setMenuOpen(false);
  }

  function handleDrawerDragEnd(_event: unknown, info: PanInfo) {
    if (isDismissGesture(info)) {
      dismissMenu();
    }
  }

  useEffect(() => {
    if (!isMenuOpen) {
      return undefined;
    }
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dismissMenu();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen, dismissMenu]);

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#contenido">
        Saltar al contenido
      </a>

      <aside className={styles.sidebar} aria-label="Barra lateral">
        <Sidebar user={user} layoutGroupId="barra-fija" />
      </aside>

      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.button
              key="fondo"
              type="button"
              tabIndex={-1}
              aria-label="Cerrar menú"
              className={styles.backdrop}
              onClick={dismissMenu}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              key="menu"
              id={MOBILE_MENU_ID}
              role="dialog"
              aria-modal="true"
              aria-label="Menú"
              className={styles.drawer}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0.6, right: 0 }}
              onDragEnd={handleDrawerDragEnd}
            >
              <button
                ref={closeButtonRef}
                type="button"
                className={styles.closeButton}
                aria-label="Cerrar menú"
                onClick={dismissMenu}
              >
                <CloseIcon />
              </button>
              <Sidebar
                user={user}
                layoutGroupId="menu-movil"
                onNavigate={closeMenuAfterNavigation}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className={styles.main} inert={isMenuOpen}>
        <header className={styles.topbar}>
          <button
            ref={menuButtonRef}
            type="button"
            className={styles.menuButton}
            aria-label="Abrir menú"
            aria-expanded={isMenuOpen}
            aria-controls={MOBILE_MENU_ID}
            onClick={openMenu}
          >
            <MenuIcon />
          </button>
          <span className={styles.topbarBrand}>ZEAL</span>
          <Avatar name={user.fullName} tone={ROLE_PROFILE[user.role].avatarTone} />
        </header>

        <main id="contenido" className={styles.content} tabIndex={-1}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
