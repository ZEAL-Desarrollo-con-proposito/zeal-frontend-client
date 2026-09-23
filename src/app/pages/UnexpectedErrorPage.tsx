import shieldIcon from '@/assets/icons/shield.svg';
import { LinkButton } from '@/shared/ui/Button/LinkButton';
import { PATHS } from '../paths';
import { StatusPage } from './StatusPage';

/** Figma F5 · Error del servidor: cualquier vista puede caer aquí ante un error no controlado. */
export function UnexpectedErrorPage() {
  return (
    <StatusPage
      icon={shieldIcon}
      code="Error inesperado"
      title="Algo salió mal"
      description="No pudimos mostrar esta pantalla. Vuelve al inicio e inténtalo de nuevo."
      action={<LinkButton to={PATHS.root}>Volver al inicio</LinkButton>}
    />
  );
}
