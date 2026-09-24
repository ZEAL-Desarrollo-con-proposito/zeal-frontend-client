import { motion } from 'motion/react';
import logoutIcon from '@/assets/icons/logout.svg';
import { pressFeedback } from '@/shared/ui/Button/pressFeedback';
import { useAuth } from '../hooks/useAuth';
import styles from './LogoutButton.module.css';

export function LogoutButton() {
  const { signOut } = useAuth();

  return (
    <motion.button type="button" className={styles.logout} onClick={signOut} {...pressFeedback}>
      <img src={logoutIcon} alt="" width={16} height={16} />
      Cerrar sesión
    </motion.button>
  );
}
