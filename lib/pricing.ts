// Redondeo del precio de venta y precio mayorista (funciones puras, con pruebas en lib/pricing.test.ts).
export const ROUND_STEPS = [0, 10, 50, 100, 500] as const;

// Redondea hacia arriba al múltiplo elegido (redondear para abajo comería ganancia). 0 = sin redondear.
export function roundPrice(price: number, step: number) {
  if (!Number.isFinite(price) || price <= 0) return 0;
  if (!step) return price;
  return Math.ceil(price / step - 1e-9) * step;
}

export function wholesalePrice(price: number, discountPct: number, step: number) {
  const pct = Math.min(Math.max(discountPct, 0), 90);
  return roundPrice(price * (1 - pct / 100), step);
}
