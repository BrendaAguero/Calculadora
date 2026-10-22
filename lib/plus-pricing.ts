// Ahorro de pagar un año de Personal Plus de una vez frente a 12 meses sueltos.
export function annualSavings(monthly: number, annual: number | null) {
  if (!annual || monthly <= 0) return { savings: 0, freeMonths: 0 };
  const savings = Math.max(monthly * 12 - annual, 0);
  return { savings, freeMonths: Math.floor(savings / monthly) };
}
