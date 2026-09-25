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
