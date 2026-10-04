import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatComposer } from './ChatComposer';

/** jsdom no calcula el alto del `<textarea>`: se simula el que tendría con contenido. */
function altoDe(px: number | ((value: string) => number)) {
  Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLTextAreaElement) {
      return typeof px === 'function' ? px(this.value) : px;
    },
  });
}

function renderComposer(disabled?: boolean) {
  const onSend = vi.fn();
  const user = userEvent.setup();
  render(<ChatComposer onSend={onSend} {...(disabled === undefined ? {} : { disabled })} />);
  return { onSend, user, caja: screen.getByRole('textbox', { name: 'Escribe un mensaje' }) };
}

describe('ChatComposer', () => {
  afterEach(() => {
    Reflect.deleteProperty(HTMLTextAreaElement.prototype, 'scrollHeight');
  });

  it('envía lo escrito sin espacios sobrantes y deja la caja lista para el siguiente', async () => {
    const { onSend, user, caja } = renderComposer();

    await user.type(caja, '  ¿Cómo has estado?  ');
    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    expect(onSend).toHaveBeenCalledExactlyOnceWith('¿Cómo has estado?');
    expect(caja).toHaveValue('');
    expect(caja).toHaveFocus();
  });

  it('Enter envía el mensaje y Shift+Enter solo escribe el salto de línea', async () => {
    const { onSend, user, caja } = renderComposer();

    await user.type(caja, 'hola{Shift>}{Enter}{/Shift}fin');
    expect(onSend).not.toHaveBeenCalled();
    expect(caja).toHaveValue('hola\nfin');

    await user.type(caja, '{Enter}');

    expect(onSend).toHaveBeenCalledExactlyOnceWith('hola\nfin');
  });

  it('no manda texto en blanco ni deja pulsar el botón sin escribir', async () => {
    const { onSend, user, caja } = renderComposer();
    const boton = screen.getByRole('button', { name: 'Enviar mensaje' });

    expect(boton).toBeDisabled();
    await user.type(caja, '    ');
    expect(boton).toBeDisabled();
    await user.type(caja, '{Enter}');

    expect(onSend).not.toHaveBeenCalled();
  });

  it('otra tecla cualquiera no envía nada', async () => {
    const { onSend, user, caja } = renderComposer();

    await user.type(caja, 'hola{Tab}a');

    expect(onSend).not.toHaveBeenCalled();
  });

  it('la caja crece con el mensaje hasta su límite', async () => {
    altoDe(500);
    const { user, caja } = renderComposer();

    await user.type(caja, 'un mensaje largo');

    expect(caja).toHaveStyle({ height: '120px' });
  });

  it('la caja vuelve a una fila al vaciarse después de enviar', async () => {
    altoDe((value) => value.length * 20);
    const { user, caja } = renderComposer();

    await user.type(caja, 'hola');
    expect(caja).toHaveStyle({ height: '80px' });

    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    await waitFor(() => {
      expect(caja).toHaveStyle({ height: '0px' });
    });
  });

  it('sin conexión en tiempo real avisa y no deja escribir', () => {
    const { caja } = renderComposer(true);

    expect(caja).toBeDisabled();
    expect(caja).toHaveAttribute('placeholder', 'Esperando conexión…');
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeDisabled();
  });
});
