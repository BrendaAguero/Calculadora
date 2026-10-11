// Misma cuenta que saleTotals (servidor), para mostrarla mientras se escribe.
export function saleTotalsClient(quantity: number, unitPrice: number, unitCost: number, discount: number, commissionPct: number) {
  const subtotal = quantity * unitPrice;
  const total = Math.max(0, subtotal - discount);
  const commission = (total * commissionPct) / 100;
  const totalCost = quantity * unitCost;
  const netIncome = total - commission - totalCost;
  return { subtotal, total, commission, totalCost, netIncome, margin: total > 0 ? (netIncome / total) * 100 : 0 };
}
