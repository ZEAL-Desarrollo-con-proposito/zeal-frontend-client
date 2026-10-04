import type { KeyboardEvent } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button/Button';
import { SendIcon } from '@/shared/ui/icons';
import styles from './ChatComposer.module.css';

/** Hasta cuántos px crece la caja antes de que el texto largo empiece a hacer scroll adentro. */
const MAX_TEXTAREA_HEIGHT = 120;

interface ChatComposerProps {
  onSend: (text: string) => void;
}

/**
 * Caja de texto y botón "Enviar" del chat (HU-FE-09 · Task 349). Crece con el mensaje hasta un límite, se
 * vacía y vuelve a su tamaño al enviar, y no manda texto en blanco ni un mensaje repetido si se pulsa dos veces muy rápido.
 */
export function ChatComposer({ onSend }: Readonly<ChatComposerProps>) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();

  // La caja crece con el contenido (hasta el límite) y vuelve a su tamaño cuando se vacía.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea === null) {
      return;
    }
    textarea.style.height = 'auto';
    textarea.style.height = `${String(Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT))}px`;
  }, [text]);

  function submit() {
    const trimmed = text.trim();
    if (trimmed === '') {
      return;
    }
    onSend(trimmed);
    setText('');
    textareaRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form
      className={styles.composer}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label htmlFor={fieldId} className="visually-hidden">
        Escribe un mensaje
      </label>
      <textarea
        ref={textareaRef}
        id={fieldId}
        className={styles.textarea}
        placeholder="Escribe un mensaje…"
        rows={1}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
        onKeyDown={handleKeyDown}
      />
      <Button type="submit" aria-label="Enviar mensaje" disabled={text.trim() === ''}>
        <SendIcon />
      </Button>
    </form>
  );
}