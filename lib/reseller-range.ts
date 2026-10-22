// Precio de venta permitido para revendedoras: desde el precio oficial hasta el oficial + X % (redondeado a $100).
export function resellerSaleRange(official: number, maxMarkupPct: number) {
  const pct = Math.min(Math.max(Number.isFinite(maxMarkupPct) ? maxMarkupPct : 0, 0), 50);
  return { min: official, max: Math.round((official * (1 + pct / 100)) / 100) * 100, pct };
}
