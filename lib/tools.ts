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
