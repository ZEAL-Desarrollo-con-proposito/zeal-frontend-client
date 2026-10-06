import type { AvatarTone } from '@/shared/ui/Avatar/Avatar';

const CONNECTORS = new Set(['de', 'del', 'la', 'el', 'en', 'y', 'a', 'para', 'con', '·']);

/** Iniciales de las dos primeras palabras con significado ("Squad de Observabilidad" → "SO"). */
export function titleInitials(title: string): string {
  return title
    .split(/\s+/)
    .filter((word) => word !== '' && !CONNECTORS.has(word.toLowerCase()))
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();
}

const TONES: readonly [AvatarTone, AvatarTone, AvatarTone] = ['sage', 'mauve', 'teal'];

/** Color estable para un mismo id (siempre el mismo hexágono para la misma convocatoria o taller). */
export function toneFor(id: string): AvatarTone {
  let hash = 0;
  for (const character of id) {
    hash += character.charCodeAt(0);
  }
  return TONES[(hash % TONES.length) as 0 | 1 | 2];
}
