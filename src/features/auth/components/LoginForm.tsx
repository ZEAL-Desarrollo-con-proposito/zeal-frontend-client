import { AnimatePresence, motion } from 'motion/react';
import lockIcon from '@/assets/icons/lock.svg';
import { Button } from '@/shared/ui/Button/Button';
import { Checkbox } from '@/shared/ui/Checkbox/Checkbox';
import { useMicrosoftLogin } from '../hooks/useMicrosoftLogin';
import { MicrosoftLogo } from './MicrosoftLogo';
import styles from './LoginForm.module.css';

interface LoginFormProps {
  /** Ruta interna a la que se vuelve después de Microsoft. */
  returnTo: string;
  /** Error con el que se volvió de Microsoft, ya traducido; `null` si no hubo. */
  returnError: string | null;
}

/**
 * Inicio de sesión con Microsoft (Outlook y Microsoft 365). La app no pide contraseñas: las
 * verifica Microsoft y ZEAL solo deja entrar las cuentas registradas por la empresa.
 */
export function LoginForm({ returnTo, returnError }: Readonly<LoginFormProps>) {
  const login = useMicrosoftLogin(returnTo);
  const message = login.error ?? (login.redirecting ? null : returnError);

  return (
    <div className={styles.form}>
      <Button
        fullWidth
        disabled={login.redirecting}
        aria-busy={login.redirecting}
        onClick={() => void login.start()}
      >
        <MicrosoftLogo />
        {login.redirecting ? 'Abriendo Microsoft…' : 'Iniciar sesión con Microsoft'}
      </Button>

      <Checkbox
        label="Recordarme"
        name="remember"
        checked={login.remember}
        onChange={(event) => {
          login.setRemember(event.target.checked);
        }}
      />

      <AnimatePresence mode="wait" initial={false}>
        {message !== null && (
          <motion.p
            key={message}
            className={styles.submitError}
            role="alert"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {message}
          </motion.p>
        )}
      </AnimatePresence>

      <p className={styles.confidentiality}>
        <img src={lockIcon} alt="" width={18} height={18} />
        Tu contraseña la protege Microsoft: ZEAL nunca la ve ni la guarda.
      </p>
    </div>
  );
}
