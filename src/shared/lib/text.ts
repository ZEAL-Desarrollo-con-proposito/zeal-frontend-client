/** Primera palabra de un nombre completo ("Laura Martínez" → "Laura"). */
export function getFirstName(fullName: string): string {
  return fullName.trim().replace(/\s.*/su, '');
}

/** Iniciales de las dos primeras palabras ("Laura Martínez" → "LM"). */
export function getInitials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();
}

/** Fecha larga en español con mayúscula inicial ("Martes, 23 de septiembre"). */
export function formatLongDate(date: Date): string {
  const formatted = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
