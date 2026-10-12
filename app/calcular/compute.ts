// Cálculo de Yeso. Lo usan la pantalla (resultado en vivo) y el servidor (al guardar), para que den lo mismo.

export type Mode = 'easy' | 'standard' | 'personalized';
export type PriceMethod = 'percentage' | 'fixed' | 'manual';

export type CalcInput = {
  mode: Mode;
  quantity: string;
  moldWater: string; // gramos de agua que entran en el molde (modo Fácil)
  plasterPerPiece: string; // gramos de yeso por pieza; si está vacío se usa moldWater
  waterPercentage: string;
  plasterPriceKg: string;
  waste: string;
  moldCost: string;
  packaging: string;
  labor: string;
  electricity: string;
  gas: string;
  commissions: string;
  other: string;
  supplies?: string; // otros materiales de la tanda (pigmento, argollas, mechas…), en todos los modos
  priceMethod: PriceMethod;
  profitPercentage: string;
  fixedProfit: string;
  manualPrice: string;
};

export type CostType = 'material' | 'waste' | 'mold' | 'packaging' | 'labor' | 'electricity' | 'gas' | 'commission' | 'other';

export type CalcItem = { cost_type: CostType; name: string; quantity: number; unit: string; unit_cost: number; total_cost: number };

export const EXTRA_COSTS: { key: keyof CalcInput; type: CostType; label: string; modes: Mode[] }[] = [
  { key: 'supplies', type: 'other', label: 'Otros materiales', modes: ['easy', 'standard', 'personalized'] },
  { key: 'moldCost', type: 'mold', label: 'Molde', modes: ['standard', 'personalized'] },
  { key: 'packaging', type: 'packaging', label: 'Packaging', modes: ['standard', 'personalized'] },
  { key: 'labor', type: 'labor', label: 'Mano de obra', modes: ['personalized'] },
  { key: 'electricity', type: 'electricity', label: 'Electricidad', modes: ['personalized'] },
  { key: 'gas', type: 'gas', label: 'Gas', modes: ['personalized'] },
  { key: 'commissions', type: 'commission', label: 'Comisiones', modes: ['personalized'] },
  { key: 'other', type: 'other', label: 'Otros', modes: ['personalized'] },
];

export function num(value: string) {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function compute(input: CalcInput) {
  const pieces = Math.max(1, Math.floor(num(input.quantity)) || 1);
  // Yeso: si no se conoce el yeso por pieza, el peso del agua que entra en el molde se toma como gramos de yeso.
  const plaster = num(input.plasterPerPiece) || num(input.moldWater);
  const plasterTotal = plaster * pieces;
  const waterPercentage = num(input.waterPercentage);
  const waterTotal = plasterTotal * (waterPercentage / 100);
  const wastePercentage = num(input.waste);
  const wasteAmount = plasterTotal * (wastePercentage / 100);
  const pricePerGram = num(input.plasterPriceKg) / 1000;

  const items: CalcItem[] = [
    { cost_type: 'material', name: 'Yeso', quantity: plasterTotal, unit: 'g', unit_cost: pricePerGram, total_cost: plasterTotal * pricePerGram },
  ];
  if (wasteAmount > 0) items.push({ cost_type: 'waste', name: `Merma (${wastePercentage} %)`, quantity: wasteAmount, unit: 'g', unit_cost: pricePerGram, total_cost: wasteAmount * pricePerGram });
  // Solo cuentan los costos del modo elegido: los valores de otros modos se conservan pero no suman.
  for (const extra of EXTRA_COSTS) {
    const value = num((input[extra.key] as string | undefined) ?? '');
    if (value > 0 && extra.modes.includes(input.mode)) items.push({ cost_type: extra.type, name: extra.label, quantity: 1, unit: 'tanda', unit_cost: value, total_cost: value });
  }

  const totalCost = items.reduce((sum, item) => sum + item.total_cost, 0);
  const unitCost = totalCost / pieces;
  const price = input.priceMethod === 'percentage'
    ? unitCost * (1 + num(input.profitPercentage) / 100)
    : input.priceMethod === 'fixed'
      ? unitCost + num(input.fixedProfit)
      : num(input.manualPrice);
  const profit = price - unitCost;
  const margin = price > 0 ? (profit / price) * 100 : 0;

  return { pieces, plaster, plasterTotal, waterPercentage, waterTotal, wastePercentage, wasteAmount, items, totalCost, unitCost, price, profit, margin };
}
