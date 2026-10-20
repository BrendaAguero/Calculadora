// Ajuste de precios por inflación: se recomienda cada 3 meses.
export const ADJUST_EVERY_DAYS = 90;

// true si nunca se ajustó o pasaron 90 días o más desde el último ajuste.
export function adjustDue(lastIso: string | null, now = new Date()) {
  if (!lastIso) return true;
  const last = new Date(lastIso).getTime();
  if (Number.isNaN(last)) return true;
  return now.getTime() - last >= ADJUST_EVERY_DAYS * 86400000;
}
