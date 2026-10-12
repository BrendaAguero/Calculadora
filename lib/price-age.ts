// Precios de materiales que conviene revisar (con la inflación, a los 60 días ya suelen estar viejos).
export const OLD_PRICE_DAYS = 60;

export const daysSince = (iso: string, now: number) => Math.floor((now - new Date(iso).getTime()) / 86_400_000);
export const isOldPrice = (iso: string | null | undefined, now: number) => Boolean(iso) && daysSince(iso!, now) >= OLD_PRICE_DAYS;

export function ageLabel(days: number) {
  if (days < 1) return 'hoy';
  if (days < 30) return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
  const months = Math.floor(days / 30);
  return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
}
