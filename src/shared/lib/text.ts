/** Primera palabra de un nombre completo ("Laura Martínez" → "Laura"). */
export function getFirstName(fullName: string): string {
  return fullName.trim().replace(/\s.*/su, '');
}

/** Texto comparable en una búsqueda: sin tildes, sin mayúsculas ni espacios extremos. */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
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
