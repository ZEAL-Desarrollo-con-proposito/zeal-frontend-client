import { useId, useRef } from 'react';
import { CloseIcon, SearchIcon } from '../icons';
import styles from './SearchField.module.css';

interface SearchFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

/** Campo de búsqueda con etiqueta accesible, lupa y botón para borrar lo escrito. */
export function SearchField({ label, placeholder, value, onChange }: Readonly<SearchFieldProps>) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className="visually-hidden">
        {label}
      </label>
      <span className={styles.icon}>
        <SearchIcon />
      </span>
      <input
        ref={inputRef}
        id={inputId}
        type="search"
        className={styles.input}
        placeholder={placeholder}
        autoComplete="off"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      {value !== '' && (
        <button
          type="button"
          className={styles.clear}
          aria-label="Borrar búsqueda"
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
}
