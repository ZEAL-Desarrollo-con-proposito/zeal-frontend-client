import briefcaseIcon from '@/assets/icons/briefcase.svg';
import calendarIcon from '@/assets/icons/calendar.svg';
import chartIcon from '@/assets/icons/chart.svg';
import clockIcon from '@/assets/icons/clock.svg';
import heartIcon from '@/assets/icons/heart.svg';
import homeIcon from '@/assets/icons/home.svg';
import messageIcon from '@/assets/icons/message.svg';
import settingsIcon from '@/assets/icons/settings.svg';
import starIcon from '@/assets/icons/star.svg';
import trendingIcon from '@/assets/icons/trending.svg';
import usersIcon from '@/assets/icons/users.svg';
import videoIcon from '@/assets/icons/video.svg';
import type { Role } from '@/features/auth/model/session';
import type { AvatarTone } from '@/shared/ui/Avatar/Avatar';
import { ROLE_BASE_PATH, ROLE_HOME_PATH } from './paths';

export interface NavItem {
  label: string;
  path: string;
  icon: string;
}

function section(role: Role, segment: string): string {
  return `${ROLE_BASE_PATH[role]}/${segment}`;
}

/** Menú lateral de cada rol (Figma: componentes Nav / Empleado, Nav / Psicologo y Nav / Admin). */
export const NAVIGATION: Record<Role, readonly NavItem[]> = {
  EMPLEADO: [
    { label: 'Inicio', path: ROLE_HOME_PATH.EMPLEADO, icon: homeIcon },
    { label: 'Bienestar', path: section('EMPLEADO', 'bienestar'), icon: heartIcon },
    { label: 'Mis citas', path: section('EMPLEADO', 'mis-citas'), icon: calendarIcon },
    { label: 'Talleres', path: section('EMPLEADO', 'talleres'), icon: usersIcon },
    { label: 'Proyectos', path: section('EMPLEADO', 'proyectos'), icon: briefcaseIcon },
    { label: 'ZEAL Path', path: section('EMPLEADO', 'zeal-path'), icon: trendingIcon },
    { label: 'Mensajes', path: section('EMPLEADO', 'mensajes'), icon: messageIcon },
  ],
  PSICOLOGO: [
    { label: 'Mi agenda', path: ROLE_HOME_PATH.PSICOLOGO, icon: calendarIcon },
    { label: 'Pacientes', path: section('PSICOLOGO', 'pacientes'), icon: usersIcon },
    { label: 'Mensajes', path: section('PSICOLOGO', 'mensajes'), icon: messageIcon },
    { label: 'Talleres', path: section('PSICOLOGO', 'talleres'), icon: videoIcon },
    { label: 'Disponibilidad', path: section('PSICOLOGO', 'disponibilidad'), icon: clockIcon },
    { label: 'Resumen', path: section('PSICOLOGO', 'resumen'), icon: trendingIcon },
  ],
  ADMIN: [
    { label: 'Panel', path: ROLE_HOME_PATH.ADMIN, icon: chartIcon },
    { label: 'Empleados', path: section('ADMIN', 'empleados'), icon: usersIcon },
    { label: 'Proyectos', path: section('ADMIN', 'proyectos'), icon: briefcaseIcon },
    { label: 'Talleres', path: section('ADMIN', 'talleres'), icon: starIcon },
    { label: 'Reportes', path: section('ADMIN', 'reportes'), icon: trendingIcon },
    { label: 'Organización', path: section('ADMIN', 'organizacion'), icon: settingsIcon },
  ],
};

/** Cómo se presenta cada rol en la interfaz (color del avatar según el Figma). */
export const ROLE_PROFILE: Record<Role, { label: string; avatarTone: AvatarTone }> = {
  EMPLEADO: { label: 'Empleado', avatarTone: 'sage' },
  PSICOLOGO: { label: 'Psicólogo/a', avatarTone: 'teal' },
  ADMIN: { label: 'Admin', avatarTone: 'mauve' },
};
