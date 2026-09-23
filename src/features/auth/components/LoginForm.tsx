import type { SubmitEvent } from 'react';
import { useRef, useState } from 'react';
import lockIcon from '@/assets/icons/lock.svg';
import shieldIcon from '@/assets/icons/shield.svg';
import { Button } from '@/shared/ui/Button/Button';
import { Checkbox } from '@/shared/ui/Checkbox/Checkbox';
import { TextField } from '@/shared/ui/TextField/TextField';
import type { AuthenticatedHandler } from '../hooks/useLoginForm';
import { useLoginForm } from '../hooks/useLoginForm';
import styles from './LoginForm.module.css';

/** Opciones visibles en el diseño que no hacen parte del alcance del MVP (HU-01: usuarios semilla). */
const OUT_OF_SCOPE_NOTICES = {
  passwordRecovery:
    'La recuperación de contraseña llegará después del MVP. Si la olvidaste, contacta a Talento Humano de tu empresa.',
  sso: 'El ingreso con SSO empresarial llegará después del MVP. Por ahora ingresa con tu correo y contraseña.',
};

interface LoginFormProps {
  onAuthenticated: AuthenticatedHandler;
}

export function LoginForm({ onAuthenticated }: Readonly<LoginFormProps>) {
  const form = useLoginForm(onAuthenticated);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState('');

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = form.submit();
    if (errors.email !== undefined) {
      emailRef.current?.focus();
    } else if (errors.password !== undefined) {
      passwordRef.current?.focus();
    }
  }

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      <TextField
        ref={emailRef}
        label="Correo corporativo"
        type="email"
        name="email"
        autoComplete="username"
        placeholder="nombre@empresa.com"
        value={form.credentials.email}
        onChange={(event) => {
          form.updateField('email', event.target.value);
        }}
        error={form.fieldErrors.email}
      />
      <TextField
        ref={passwordRef}
        label="Contraseña"
        type="password"
        name="password"
        autoComplete="current-password"
        placeholder="••••••••••"
        value={form.credentials.password}
        onChange={(event) => {
          form.updateField('password', event.target.value);
        }}
        error={form.fieldErrors.password}
      />

      <div className={styles.row}>
        <Checkbox
          label="Recordarme"
          name="remember"
          checked={form.remember}
          onChange={(event) => {
            form.setRemember(event.target.checked);
          }}
        />
        <button
          type="button"
          className={styles.textLink}
          onClick={() => {
            setNotice(OUT_OF_SCOPE_NOTICES.passwordRecovery);
          }}
        >
          ¿Olvidaste tu contraseña?
        </button>
      </div>

      {form.submitError !== null && (
        <p className={styles.submitError} role="alert">
          {form.submitError}
        </p>
      )}

      <Button type="submit" fullWidth disabled={form.isSubmitting} aria-busy={form.isSubmitting}>
        {form.isSubmitting ? 'Ingresando…' : 'Iniciar sesión'}
      </Button>

      <div className={styles.divider}>
        <span>o</span>
      </div>

      <Button
        variant="outline"
        fullWidth
        onClick={() => {
          setNotice(OUT_OF_SCOPE_NOTICES.sso);
        }}
      >
        <img src={shieldIcon} alt="" width={20} height={20} />
        Continuar con SSO empresarial
      </Button>

      <p className={styles.notice} role="status">
        {notice}
      </p>

      <p className={styles.confidentiality}>
        <img src={lockIcon} alt="" width={18} height={18} />
        Tus sesiones y chats están cifrados de extremo a extremo.
      </p>
    </form>
  );
}
