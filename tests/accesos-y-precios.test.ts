// Pruebas de quién puede usar qué (planes) y de las cuentas de precios. Correr con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getResourceLimit, hasFeature, showsAds, type AccessSnapshot } from '../lib/access/rules.ts';
import { adjustDue } from '../lib/price-adjust.ts';
import { annualSavings } from '../lib/plus-pricing.ts';

const base: AccessSnapshot = {
  accountStatus: 'active', isAdmin: false, isModerator: false, isTester: false,
  basePlan: null, baseLicenseActive: false, licenseExpiresAt: null, isFree: true,
  entrepreneurActive: false, entrepreneurExpiresAt: null, plusTrialEndsAt: null, activities: [], modules: [], limits: {},
};
const free = base;
const personal: AccessSnapshot = { ...base, basePlan: 'ADVANCED', baseLicenseActive: true, isFree: false };
const plus: AccessSnapshot = { ...base, entrepreneurActive: true, isFree: false };

test('Gratis: sin Colores, Cuaderno ni ventas; límites chicos y publicidad', () => {
  assert.equal(hasFeature(free, 'COLORES'), false);
  assert.equal(hasFeature(free, 'CUADERNO'), false);
  assert.equal(hasFeature(free, 'VENTAS'), false);
  assert.equal(getResourceLimit(free, 'materials'), 5);
  assert.equal(getResourceLimit(free, 'products'), 2);
  assert.equal(showsAds(free), true);
});

test('Edición Personal: Colores y Cuaderno incluidos; el pack se compra aparte', () => {
  assert.equal(hasFeature(personal, 'COLORES'), true);
  assert.equal(hasFeature(personal, 'CUADERNO'), true);
  assert.equal(hasFeature(personal, 'VENTAS'), false);
  assert.equal(hasFeature({ ...personal, modules: ['PACK_VENTAS'] }, 'VENTAS'), true);
  assert.equal(hasFeature({ ...personal, modules: ['PACK_VENTAS'] }, 'STOCK_BASICO'), true);
  assert.equal(getResourceLimit(personal, 'materials'), 100);
  assert.equal(showsAds(personal), true);
});

test('Personal Plus: todo, sin límites y sin publicidad (con o sin Edición Personal)', () => {
  for (const snapshot of [plus, { ...personal, entrepreneurActive: true }]) {
    assert.equal(hasFeature(snapshot, 'VENTAS'), true);
    assert.equal(hasFeature(snapshot, 'COLORES'), true);
    assert.equal(getResourceLimit(snapshot, 'materials'), Number.POSITIVE_INFINITY);
    assert.equal(showsAds(snapshot), false);
  }
});

test('Cuenta suspendida: no usa nada aunque tenga Plus', () => {
  const suspended = { ...plus, accountStatus: 'suspended' as const };
  assert.equal(hasFeature(suspended, 'VENTAS'), false);
  assert.equal(getResourceLimit(suspended, 'materials'), 0);
});

test('Administración y cuentas de prueba: todo', () => {
  assert.equal(hasFeature({ ...free, isAdmin: true }, 'VENTAS'), true);
  assert.equal(hasFeature({ ...free, isTester: true }, 'CUADERNO'), true);
  assert.equal(showsAds({ ...free, isAdmin: true }), false);
});

test('Ajuste por inflación: avisa a los 90 días o si nunca se hizo', () => {
  const now = new Date('2026-10-20T12:00:00Z');
  assert.equal(adjustDue(null, now), true);
  assert.equal(adjustDue('no es una fecha', now), true);
  assert.equal(adjustDue('2026-08-01T12:00:00Z', now), false);
  assert.equal(adjustDue('2026-07-22T12:00:00Z', now), true);
});

test('Ahorro del pago anual de Personal Plus', () => {
  assert.deepEqual(annualSavings(6900, 69000), { savings: 13800, freeMonths: 2 });
  assert.deepEqual(annualSavings(6900, null), { savings: 0, freeMonths: 0 });
  assert.deepEqual(annualSavings(6900, 90000), { savings: 0, freeMonths: 0 });
});
