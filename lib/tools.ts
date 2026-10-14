// Cuentas de las herramientas de la calculadora (funciones puras, con pruebas en tests/).

// Precio para publicar en una tienda online para recibir «neto» después de la comisión,
// el cargo fijo por venta y el envío que paga la vendedora.
export function marketplacePrice(net: number, feePct: number, fixedFee = 0, shipping = 0) {
  const fee = Math.min(Math.max(feePct, 0), 90) / 100;
  if (!(net > 0)) return 0;
  return (net + Math.max(fixedFee, 0) + Math.max(shipping, 0)) / (1 - fee);
}

// Cuántas piezas salen con lo que hay de material, contando la merma.
export function piecesFrom(stockGrams: number, gramsPerPiece: number, wastePct = 0) {
  if (!(stockGrams > 0) || !(gramsPerPiece > 0)) return { pieces: 0, leftover: Math.max(stockGrams, 0) };
  const perPiece = gramsPerPiece * (1 + Math.max(wastePct, 0) / 100);
  const pieces = Math.floor(stockGrams / perPiece + 1e-9);
  return { pieces, leftover: stockGrams - pieces * perPiece };
}

// Costo de la mano de obra por pieza: valor de la hora × minutos que lleva.
export function laborPerPiece(hourly: number, minutes: number) {
  if (!(hourly > 0) || !(minutes > 0)) return 0;
  return (hourly * minutes) / 60;
}

// Valor de la hora a partir de lo que se quiere ganar por mes y las horas que se trabajan.
export function hourlyFromMonthly(monthly: number, hoursPerMonth: number) {
  return monthly > 0 && hoursPerMonth > 0 ? monthly / hoursPerMonth : 0;
}

// Kit o combo: suma de las piezas (costo × cantidad) más el packaging, y el precio con la ganancia.
export function kitPrice(items: { cost: number; qty: number }[], packaging: number, profitPct: number) {
  const cost = items.reduce((acc, i) => acc + Math.max(i.cost, 0) * Math.max(i.qty, 0), 0) + Math.max(packaging, 0);
  return { cost, price: cost * (1 + Math.max(profitPct, 0) / 100) };
}

// Conversor de medidas: gramos, kilos, mililitros, litros, cucharadas, cucharaditas y tazas.
// Para pasar de peso a volumen usa la densidad aproximada del material (gramos por ml, sin apretar).
export const MEASURE_UNITS = {
  g: { label: 'gramos', grams: 1 },
  kg: { label: 'kilos', grams: 1000 },
  ml: { label: 'mililitros (cc)', ml: 1 },
  l: { label: 'litros', ml: 1000 },
  cda: { label: 'cucharadas', ml: 15 },
  cdta: { label: 'cucharaditas', ml: 5 },
  taza: { label: 'tazas', ml: 240 },
} as const;
export type MeasureUnit = keyof typeof MEASURE_UNITS;

export const MEASURE_MATERIALS = [
  { id: 'agua', label: 'Agua', density: 1 },
  { id: 'yeso', label: 'Yeso en polvo', density: 0.8 },
  { id: 'cemento', label: 'Cemento en polvo', density: 1.4 },
  { id: 'arena', label: 'Arena fina', density: 1.5 },
  { id: 'resina', label: 'Resina epoxi (líquida)', density: 1.1 },
  { id: 'pigmento', label: 'Pigmento en polvo o mica', density: 0.5 },
] as const;

export function convertMeasure(value: number, from: MeasureUnit, to: MeasureUnit, density: number) {
  if (!(value >= 0) || !(density > 0)) return 0;
  const f = MEASURE_UNITS[from] as { grams?: number; ml?: number };
  const t = MEASURE_UNITS[to] as { grams?: number; ml?: number };
  const grams = f.grams ? value * f.grams : value * f.ml! * density;
  return t.grams ? grams / t.grams : grams / density / t.ml!;
}
