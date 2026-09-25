import { sessionRoomPath } from '@/app/paths';
import { LinkButton } from '@/shared/ui/Button/LinkButton';
import { ArrowRightIcon } from '@/shared/ui/icons';
import type { Reservation } from '../model/reservation';

interface JoinRoomLinkProps {
  reservation: Reservation;
}

/** Acceso a la sala de una sesión cuya ventana de ingreso está abierta. */
export function JoinRoomLink({ reservation }: Readonly<JoinRoomLinkProps>) {
  return (
    <LinkButton
      to={sessionRoomPath(reservation.id)}
      aria-label={`Entrar a la sala con ${reservation.employee.fullName}`}
    >
      Entrar a la sala
      <ArrowRightIcon />
    </LinkButton>
  );
}
