// Tipos de movimiento que se registran a mano. La producción (Etapa 14) usará production_consumption / production_output.
export const MOVEMENT_KINDS = [
  { value: 'purchase', label: 'Entrada: compra', sign: 1 },
  { value: 'return', label: 'Entrada: devolución', sign: 1 },
  { value: 'sale', label: 'Salida: venta', sign: -1 },
  { value: 'other', label: 'Salida: uso, merma o regalo', sign: -1 },
  { value: 'count', label: 'Corregir con un conteo (cantidad real)', sign: 0 },
] as const;

export const MOVEMENT_LABELS: Record<string, string> = {
  purchase: 'Compra',
  return: 'Devolución',
  sale: 'Venta',
  other: 'Salida',
  adjustment: 'Ajuste',
  production_consumption: 'Usado en producción',
  production_output: 'Producido',
};

// Conversión entre unidades del mismo tipo (peso, volumen o unidades).
export const UNIT_FACTORS: Record<string, { group: string; factor: number }> = {
  mg: { group: 'mass', factor: 0.001 },
  g: { group: 'mass', factor: 1 },
  kg: { group: 'mass', factor: 1000 },
  ml: { group: 'volume', factor: 1 },
  l: { group: 'volume', factor: 1000 },
  unidad: { group: 'count', factor: 1 },
  unidades: { group: 'count', factor: 1 },
};

export function compatibleUnits(unit: string) {
  const group = UNIT_FACTORS[unit]?.group;
  return group ? Object.keys(UNIT_FACTORS).filter((u) => UNIT_FACTORS[u].group === group && u !== 'unidades') : [unit];
}

// Convierte una cantidad a la unidad del stock. Devuelve null si las unidades no son compatibles.
export function convert(quantity: number, from: string, to: string) {
  if (from === to) return quantity;
  const a = UNIT_FACTORS[from];
  const b = UNIT_FACTORS[to];
  if (!a || !b || a.group !== b.group) return null;
  return (quantity * a.factor) / b.factor;
}

export const qty = (value: number | string | null) => Number(value ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 3 });
// Cantidad con su unidad, en plural cuando corresponde («1 unidad», «5 unidades»).
export const amount = (value: number | string | null, unit: string) => `${qty(value)} ${unit === 'unidad' && Math.abs(Number(value ?? 0)) !== 1 ? 'unidades' : unit}`;
export const money = (value: number | string | null) => Number(value ?? 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });
