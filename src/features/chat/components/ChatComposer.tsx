import type { KeyboardEvent, SubmitEvent } from 'react';
import { useEffect, useId, useState } from 'react';
import { Button } from '@/shared/ui/Button/Button';
import { SendIcon } from '@/shared/ui/icons';
import styles from './ChatComposer.module.css';

/** Hasta cuántos px crece la caja antes de que el texto largo empiece a hacer scroll adentro. */
const MAX_TEXTAREA_HEIGHT = 120;

const noop = () => undefined;

interface ChatComposerProps {
  onSend: (text: string) => void;
  /** Sin conexión en tiempo real un mensaje enviado se perdería en silencio (Task 351). */
  disabled?: boolean;
  /** Avisa que esta persona empezó o dejó de escribir (Task 355). */
  onTyping?: (typing: boolean) => void;
}

/** La caja crece con lo que se escribe hasta el límite, y vuelve a una fila cuando queda vacía. */
function fitToContent(textarea: HTMLTextAreaElement) {
  textarea.style.height = 'auto';
  textarea.style.height = `${String(Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT))}px`;
}

/**
 * Caja de texto y botón "Enviar" del chat (HU-FE-09 · Task 349). Crece con el mensaje hasta un límite, se
 * vacía y vuelve a su tamaño al enviar, y no manda texto en blanco ni un mensaje repetido si se pulsa dos veces muy rápido.
 * Al teclear avisa que está escribiendo (Task 355); al enviar, avisa que dejó de hacerlo.
 */
export function ChatComposer({
  onSend,
  disabled = false,
  onTyping = noop,
}: Readonly<ChatComposerProps>) {
  const [text, setText] = useState('');
  const [textarea, setTextarea] = useState<HTMLTextAreaElement | null>(null);
  const fieldId = useId();

  // Se ajusta después de pintar, para medir la caja con el texto nuevo.
  useEffect(() => {
    if (textarea === null) {
      return;
    }
    fitToContent(textarea);
  }, [text, textarea]);

  function submit(element: HTMLTextAreaElement) {
    const trimmed = text.trim();
    if (trimmed === '') {
      return;
    }
    onSend(trimmed);
    onTyping(false);
    setText('');
    element.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit(event.currentTarget);
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    // El `<textarea>` es el único control del formulario: se busca por su id para devolverle el foco.
    submit(event.currentTarget.elements.namedItem(fieldId) as HTMLTextAreaElement);
  }

  return (
    <form className={styles.composer} onSubmit={handleSubmit}>
      <label htmlFor={fieldId} className="visually-hidden">
        Escribe un mensaje
      </label>
      <textarea
        ref={setTextarea}
        id={fieldId}
        className={styles.textarea}
        placeholder={disabled ? 'Esperando conexión…' : 'Escribe un mensaje…'}
        rows={1}
        value={text}
        disabled={disabled}
        onChange={(event) => {
          setText(event.target.value);
          onTyping(event.target.value.trim() !== '');
        }}
        onKeyDown={handleKeyDown}
      />
      <Button type="submit" aria-label="Enviar mensaje" disabled={disabled || text.trim() === ''}>
        <SendIcon />
      </Button>
    </form>
  );
}
