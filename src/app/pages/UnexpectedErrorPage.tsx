import { useEffect } from 'react';
import { useRouteError } from 'react-router';
import shieldIcon from '@/assets/icons/shield.svg';
import { reportError } from '@/shared/telemetry/errorTelemetry';
import { LinkButton } from '@/shared/ui/Button/LinkButton';
import { PATHS } from '../paths';
import { StatusPage } from './StatusPage';

/** Figma F5 · Error del servidor: cualquier vista puede caer aquí ante un error no controlado. */
export function UnexpectedErrorPage() {
  const error = useRouteError();

  useEffect(() => {
    reportError(error);
  }, [error]);

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
