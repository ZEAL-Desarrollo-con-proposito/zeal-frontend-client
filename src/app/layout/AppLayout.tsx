import type { PanInfo } from 'motion/react';
import { AnimatePresence, motion } from 'motion/react';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useMatches } from 'react-router';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { FreedSlotAlerts } from '@/features/freedSlots/components/FreedSlotAlerts';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { OpenCallAnnouncer } from '@/features/openCalls/components/OpenCallAnnouncer';
import { Avatar } from '@/shared/ui/Avatar/Avatar';
import { LoadingStatus } from '@/shared/ui/LoadingStatus/LoadingStatus';
import { RealtimeStatusBadge } from './RealtimeStatusBadge';
import { CloseIcon, MenuIcon } from '@/shared/ui/icons';
import { ROLE_PROFILE } from '../navigation';
import { isDismissGesture } from './drawerGesture';
import { findPageTitle } from './pageHandle';
import { Sidebar } from './Sidebar';
import styles from './AppLayout.module.css';

const MOBILE_MENU_ID = 'menu-movil';
const DEFAULT_DOCUMENT_TITLE = 'ZEAL — Cuidado de la salud mental en el trabajo';

/** Estructura de las pantallas con sesión: barra lateral por rol, barra superior y contenido. */
export function AppLayout() {
  const user = useCurrentUser();
  const profile = ROLE_PROFILE[user.role];
  const { pathname } = useLocation();
  const pageTitle = findPageTitle(useMatches()) ?? profile.label;
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

  // El título de la pestaña dice dónde está la persona (útil con varias pestañas y lectores de pantalla).
  useEffect(() => {
    document.title = `${pageTitle} · ZEAL`;
    return () => {
      document.title = DEFAULT_DOCUMENT_TITLE;
    };
  }, [pageTitle]);

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
          <p className={styles.context}>
            <span>{profile.label}</span>
            <span aria-hidden="true">/</span>
            <span className={styles.contextPage}>{pageTitle}</span>
          </p>
          <div className={styles.account}>
            <NotificationBell />
            <RealtimeStatusBadge />
            <span className={styles.accountIdentity}>
              <span className={styles.accountName}>{user.fullName}</span>
              <span className={styles.accountDetail}>{user.organization}</span>
            </span>
            <Avatar name={user.fullName} tone={profile.avatarTone} />
          </div>
        </header>

        <main id="contenido" className={styles.content} tabIndex={-1}>
          {/* Fuera de la animación por ruta: al cambiar de pantalla, la anterior sigue a la vista
              mientras llega la nueva; el aviso solo sale cuando no hay nada que mostrar. */}
          <Suspense fallback={<LoadingStatus>Cargando la sección…</LoadingStatus>}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </Suspense>
        </main>
      </div>

      {user.role === 'EMPLEADO' && <FreedSlotAlerts />}
      {user.role === 'EMPLEADO' && <OpenCallAnnouncer />}
    </div>
  );
}
