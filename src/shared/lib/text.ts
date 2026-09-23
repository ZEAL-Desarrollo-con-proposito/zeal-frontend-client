/** Primera palabra de un nombre completo ("Laura Martínez" → "Laura"). */
export function getFirstName(fullName: string): string {
  return fullName.trim().replace(/\s.*/su, '');
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
