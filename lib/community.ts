// Comunidad: categorías y límites (los mismos que controla la base).
export const CATEGORIES = [
  { value: 'consejo', label: 'Consejo', emoji: '💡' },
  { value: 'pregunta', label: 'Pregunta', emoji: '❓' },
  { value: 'trabajo', label: 'Mi trabajo', emoji: '✨' },
  { value: 'tutorial', label: 'Tutorial', emoji: '🎓' },
] as const;
export type Category = (typeof CATEGORIES)[number]['value'];

export const categoryInfo = (value: string) => CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[0];

export const LIMITS = { title: 120, body: 5000, comment: 2000, link: 500, reason: 300 };

// Solo enlaces https (YouTube, Instagram, TikTok, etc.).
export function readLink(value: FormDataEntryValue | null) {
  const link = String(value ?? '').trim();
  if (!link) return '';
  try {
    const url = new URL(link);
    return url.protocol === 'https:' && link.length <= LIMITS.link ? url.toString() : null;
  } catch {
    return null;
  }
}
