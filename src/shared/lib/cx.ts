type ClassValue = string | false | null | undefined;

/** Une nombres de clase CSS ignorando los valores vacíos o condicionales falsos. */
export function cx(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
