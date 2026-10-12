// Números como se escriben en Argentina: «12.500», «12.500,50», «1,5», «$ 3.000» o «1500».
// Devuelve NaN si no es un número.
export function parseAR(value: unknown): number {
  let text = String(value ?? '').trim().replace(/[\s$]/g, '');
  if (!text) return NaN;
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, '');
  return Number(text);
}
