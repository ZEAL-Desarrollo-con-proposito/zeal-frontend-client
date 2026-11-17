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
import type { Role } from '@/features/auth/model/session';
import type { AvatarTone } from '@/shared/ui/Avatar/Avatar';
import { ADMIN_PATHS, EMPLOYEE_PATHS, PSYCHOLOGIST_PATHS, ROLE_HOME_PATH } from './paths';

export interface NavItem {
  label: string;
  path: string;
  icon: string;
  /** Qué encuentra la persona en la sección (accesos rápidos y estado vacío). */
  description: string;
}

/** Menú lateral de cada rol (Figma: componentes Nav / Empleado, Nav / Psicologo y Nav / Admin). */
export const NAVIGATION: Record<Role, readonly NavItem[]> = {
  EMPLEADO: [
    {
      label: 'Inicio',
      path: ROLE_HOME_PATH.EMPLEADO,
      icon: homeIcon,
      description: 'Tu resumen del día.',
    },
    {
      label: 'Bienestar',
      path: EMPLOYEE_PATHS.wellbeing,
      icon: heartIcon,
      description: 'Encuentra psicólogos disponibles y reserva tu sesión.',
    },
    {
      label: 'Mis citas',
      path: EMPLOYEE_PATHS.appointments,
      icon: calendarIcon,
      description: 'Consulta y cancela tus sesiones programadas.',
    },
    {
      label: 'Talleres',
      path: EMPLOYEE_PATHS.workshops,
      icon: usersIcon,
      description: 'Inscríbete a talleres comunitarios con cupo limitado.',
    },
    {
      label: 'Proyectos',
      path: EMPLOYEE_PATHS.projects,
      icon: briefcaseIcon,
      description: 'Postúlate a convocatorias internas y gana experiencia.',
    },

    {
      label: 'Mensajes',
      path: EMPLOYEE_PATHS.messages,
      icon: messageIcon,
      description: 'Conversa en tiempo real con tu psicólogo o psicóloga.',
    },
  ],
  PSICOLOGO: [
    {
      label: 'Mi agenda',
      path: ROLE_HOME_PATH.PSICOLOGO,
      icon: calendarIcon,
      description: 'Tus reservas del día y el acceso a cada sesión.',
    },
    {
      label: 'Mensajes',
      path: PSYCHOLOGIST_PATHS.messages,
      icon: messageIcon,
      description: 'Conversa en tiempo real con tus pacientes.',
    },
    {
      label: 'Disponibilidad',
      path: PSYCHOLOGIST_PATHS.availability,
      icon: clockIcon,
      description: 'Crea y elimina franjas que los empleados ven al instante.',
    },
  ],
  ADMIN: [
    {
      label: 'Panel',
      path: ROLE_HOME_PATH.ADMIN,
      icon: chartIcon,
      description: 'Métricas agregadas de bienestar y adopción.',
    },
    {
      label: 'Empleados',
      path: ADMIN_PATHS.employees,
      icon: usersIcon,
      description: 'Consulta las personas de tu empresa que usan ZEAL.',
    },
    {
      label: 'Proyectos',
      path: ADMIN_PATHS.projects,
      icon: briefcaseIcon,
      description: 'Publica convocatorias internas con cupos limitados.',
    },
    {
      label: 'Talleres',
      path: ADMIN_PATHS.workshops,
      icon: starIcon,
      description: 'Programa talleres con capacidad máxima.',
    },
    {
      label: 'Reportes',
      path: ADMIN_PATHS.reports,
      icon: trendingIcon,
      description: 'Reportes agregados de la organización, nunca individuales.',
    },
    {
      label: 'Organización',
      path: ADMIN_PATHS.organization,
      icon: settingsIcon,
      description: 'Los datos de tu empresa y de las personas que la forman en ZEAL.',
    },
  ],
};

interface RoleProfile {
  label: string;
  avatarTone: AvatarTone;
  /** Propósito del espacio del rol, mostrado en su pantalla de llegada. */
  welcome: string;
  /** Garantía de confidencialidad que aplica al rol (manual de identidad, público objetivo). */
  privacyNote: string;
}

/** Cómo se presenta cada rol en la interfaz (color del avatar según el Figma). */
export const ROLE_PROFILE: Record<Role, RoleProfile> = {
  EMPLEADO: {
    label: 'Empleado',
    avatarTone: 'sage',
    welcome: 'Tu espacio para cuidar tu bienestar y crecer profesionalmente.',
    privacyNote: 'Tu organización solo ve métricas agregadas, nunca tu información individual.',
  },
  PSICOLOGO: {
    label: 'Psicólogo/a',
    avatarTone: 'teal',
    welcome: 'Gestiona tu disponibilidad, tu agenda y tus sesiones.',
    privacyNote: 'Tus sesiones y chats son privados y cifrados de extremo a extremo.',
  },
  ADMIN: {
    label: 'Admin',
    avatarTone: 'mauve',
    welcome: 'Impulsa el bienestar y el desarrollo de tu organización.',
    privacyNote: 'Solo ves métricas agregadas: la información psicológica individual es privada.',
  },
};
