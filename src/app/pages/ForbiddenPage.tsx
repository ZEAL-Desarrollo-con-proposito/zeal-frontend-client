import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { LinkButton } from '@/shared/ui/Button/LinkButton';
import { ROLE_HOME_PATH } from '../paths';
import { StatusPage } from './StatusPage';

/** Figma F7 · Permiso denegado — aislamiento entre roles. */
export function ForbiddenPage() {
  const user = useCurrentUser();

  return (
    <StatusPage
      code="Error 403 · Permiso denegado"
      title="Esta sección no está disponible para tu rol"
      description="ZEAL aísla la información de cada rol para proteger la confidencialidad de las personas."
      action={<LinkButton to={ROLE_HOME_PATH[user.role]}>Ir a mi inicio</LinkButton>}
    />
  );
}
