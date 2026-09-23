import { LinkButton } from '@/shared/ui/Button/LinkButton';
import { PATHS } from '../paths';
import { StatusPage } from './StatusPage';

export function NotFoundPage() {
  return (
    <StatusPage
      code="Error 404"
      title="No encontramos esta página"
      description="La dirección no existe o cambió. Vuelve al inicio para seguir usando ZEAL."
      action={<LinkButton to={PATHS.root}>Volver al inicio</LinkButton>}
    />
  );
}
