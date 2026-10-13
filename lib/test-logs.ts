// Cuaderno de pruebas: cómo salió cada colada.
export const RESULTS = [
  { value: 'perfecta', label: 'Perfecta', emoji: '🌟', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' },
  { value: 'buena', label: 'Buena', emoji: '🙂', badge: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200' },
  { value: 'regular', label: 'Regular', emoji: '😐', badge: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' },
  { value: 'mala', label: 'Salió mal', emoji: '😞', badge: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200' },
] as const;
export type Result = (typeof RESULTS)[number]['value'];
export const resultInfo = (value: string) => RESULTS.find((r) => r.value === value) ?? RESULTS[1];

// Fecha de hoy en Argentina (AAAA-MM-DD) para el formulario.
export const todayAR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
export const dateAR = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
