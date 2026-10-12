// Pruebas de las cuentas de precio y ganancia. Correr con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute, type CalcInput } from '../app/calcular/compute.ts';
import { computeMix, MIXES } from '../lib/mixes.ts';
import { saleTotalsClient } from '../app/ventas/nueva/totals.ts';
import { roundPrice, wholesalePrice } from '../lib/pricing.ts';

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} ≠ ${expected}`);

const yeso = (over: Partial<CalcInput>): CalcInput => ({
  mode: 'easy', quantity: '1', moldWater: '', plasterPerPiece: '', waterPercentage: '75', plasterPriceKg: '', waste: '0',
  moldCost: '', packaging: '', labor: '', electricity: '', gas: '', commissions: '', other: '',
  priceMethod: 'percentage', profitPercentage: '30', fixedProfit: '', manualPrice: '', ...over,
});

test('yeso, modo Fácil: el agua del molde se toma como gramos de yeso', () => {
  // 10 piezas de 200 g, yeso a $2000 el kg → 2 kg = $4000; por pieza $400; +30 % = $520.
  const r = compute(yeso({ quantity: '10', moldWater: '200', plasterPriceKg: '2000' }));
  close(r.plasterTotal, 2000);
  close(r.waterTotal, 1500);
  close(r.totalCost, 4000);
  close(r.unitCost, 400);
  close(r.price, 520);
  close(r.profit, 120);
  close(r.margin, (120 / 520) * 100);
});

test('yeso: la merma suma costo y los costos de otros modos no cuentan', () => {
  const r = compute(yeso({ quantity: '1', plasterPerPiece: '1000', plasterPriceKg: '1000', waste: '10', packaging: '500' }));
  // 1 kg = $1000 + merma 10 % = $100. El packaging es del modo Estándar: no suma en Fácil.
  close(r.totalCost, 1100);
  const standard = compute(yeso({ mode: 'standard', quantity: '1', plasterPerPiece: '1000', plasterPriceKg: '1000', waste: '10', packaging: '500' }));
  close(standard.totalCost, 1600);
});

test('yeso: ganancia fija y precio manual', () => {
  close(compute(yeso({ moldWater: '100', plasterPriceKg: '1000', priceMethod: 'fixed', fixedProfit: '250' })).price, 350);
  const manual = compute(yeso({ moldWater: '100', plasterPriceKg: '1000', priceMethod: 'manual', manualPrice: '80' }));
  close(manual.price, 80);
  close(manual.profit, -20);
});

test('yeso: textos raros no rompen la cuenta', () => {
  const r = compute(yeso({ quantity: 'abc', moldWater: '-5', plasterPriceKg: '1.500,5' }));
  assert.equal(r.pieces, 1);
  close(r.totalCost, 0);
  const comma = compute(yeso({ moldWater: '100', plasterPriceKg: '1000,5' }));
  close(comma.totalCost, 100.05);
});

test('resina 1:1 con merma y pigmento', () => {
  const def = MIXES.find((m) => m.code === 'RESINA')!;
  const settings = { ...def.defaults, prices: { a: '10000', b: '10000', pigment: '20000' } };
  const r = computeMix(settings, { quantity: '2', moldMl: '', gramsPerPiece: '100', moldCost: '', packaging: '', labor: '', other: '', priceMethod: 'percentage', profitPercentage: '50', fixedProfit: '', manualPrice: '' });
  // 200 g en piezas a $10/g = $2000; pigmento 1 % = 2 g a $20/g = $40; merma 10 % de $2040 = $204.
  close(r.base, 200);
  close(r.total, 220);
  close(r.totalCost, 2244);
  close(r.unitCost, 1122);
  close(r.price, 1683);
});

test('resina: sin gramos por pieza se usa el agua del molde × densidad', () => {
  const def = MIXES.find((m) => m.code === 'RESINA')!;
  const r = computeMix(def.defaults, { quantity: '1', moldMl: '100', gramsPerPiece: '', moldCost: '', packaging: '', labor: '', other: '', priceMethod: 'manual', profitPercentage: '', fixedProfit: '', manualPrice: '' });
  close(r.perPiece, 100 * def.defaults.density);
});

test('venta: descuento, comisión y ganancia', () => {
  const t = saleTotalsClient(3, 1000, 400, 300, 10);
  close(t.subtotal, 3000);
  close(t.total, 2700);
  close(t.commission, 270);
  close(t.totalCost, 1200);
  close(t.netIncome, 1230);
  // El descuento nunca deja el total en negativo.
  close(saleTotalsClient(1, 100, 0, 500, 0).total, 0);
});

test('redondeo del precio: siempre para arriba', () => {
  assert.equal(roundPrice(4437, 100), 4500);
  assert.equal(roundPrice(4400, 100), 4400);
  assert.equal(roundPrice(4401, 50), 4450);
  assert.equal(roundPrice(4437.2, 0), 4437.2);
  assert.equal(roundPrice(-10, 100), 0);
});

test('precio mayorista: descuento y redondeo', () => {
  assert.equal(wholesalePrice(1000, 20, 0), 800);
  assert.equal(wholesalePrice(1000, 15, 100), 900);
  close(wholesalePrice(1000, 200, 0), 100); // el descuento se limita a 90 %
});

import { hourlyFromMonthly, kitPrice, laborPerPiece, marketplacePrice, piecesFrom } from '../lib/tools.ts';

test('tienda online: precio para recibir lo mismo', () => {
  // Para recibir $1000 con 15 % de comisión, $100 de cargo fijo y $0 de envío: (1000 + 100) / 0,85.
  close(marketplacePrice(1000, 15, 100, 0), 1100 / 0.85);
  const price = marketplacePrice(5000, 13, 0, 800);
  close(price - price * 0.13 - 800, 5000);
  assert.equal(marketplacePrice(0, 15), 0);
});

test('cuántas piezas salen', () => {
  assert.deepEqual(piecesFrom(5000, 200, 0), { pieces: 25, leftover: 0 });
  // Con 10 % de merma cada pieza usa 220 g: 5000 / 220 = 22 piezas y sobran 160 g.
  const r = piecesFrom(5000, 200, 10);
  assert.equal(r.pieces, 22);
  close(r.leftover, 160);
  assert.equal(piecesFrom(100, 0).pieces, 0);
});

test('tu tiempo y kits', () => {
  close(laborPerPiece(3000, 20), 1000);
  close(hourlyFromMonthly(480000, 160), 3000);
  const kit = kitPrice([{ cost: 1000, qty: 3 }, { cost: 500, qty: 1 }], 300, 50);
  close(kit.cost, 3800);
  close(kit.price, 5700);
});

test('yeso: «otros materiales» suma en todos los modos', () => {
  const easy = compute(yeso({ quantity: '2', moldWater: '100', plasterPriceKg: '1000', supplies: '300' }));
  close(easy.totalCost, 200 + 300);
  close(easy.unitCost, 250);
});
