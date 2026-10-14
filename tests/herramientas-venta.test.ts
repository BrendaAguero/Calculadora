// Pruebas de las fechas para vender y del conversor de medidas. Correr con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { easter, nthWeekday, upcomingSaleDates } from '../lib/sale-dates.ts';
import { convertMeasure } from '../lib/tools.ts';

const ymd = (d: Date) => d.toISOString().slice(0, 10);

test('Día de la Madre: tercer domingo de octubre', () => {
  assert.equal(ymd(nthWeekday(2025, 10, 0, 3)), '2025-10-19');
  assert.equal(ymd(nthWeekday(2026, 10, 0, 3)), '2026-10-18');
});

test('Pascuas', () => {
  assert.equal(ymd(easter(2025)), '2025-04-20');
  assert.equal(ymd(easter(2026)), '2026-04-05');
});

test('Black Friday: viernes después del cuarto jueves de noviembre', () => {
  const d = upcomingSaleDates('2026-10-14').find((x) => x.id === 'black-friday')!;
  assert.equal(d.date, '2026-11-27');
});

test('próximas fechas ordenadas y marca de «preparar»', () => {
  const list = upcomingSaleDates('2026-10-14');
  assert.equal(list[0].id, 'madre');
  assert.equal(list[0].daysLeft, 4);
  assert.equal(list[0].preparing, true);
  assert.ok(list.every((d, i) => i === 0 || d.daysLeft >= list[i - 1].daysLeft));
  assert.ok(list.every((d) => d.daysLeft >= 0 && d.daysLeft < 366));
});

test('conversor: cucharadas, gramos y litros', () => {
  assert.equal(convertMeasure(2, 'cda', 'ml', 1), 30);
  assert.equal(convertMeasure(1, 'cda', 'g', 0.8), 12);
  assert.equal(convertMeasure(1, 'kg', 'l', 1), 1);
  assert.equal(convertMeasure(500, 'g', 'kg', 0.8), 0.5);
  assert.ok(Math.abs(convertMeasure(100, 'g', 'ml', 0.8) - 125) < 1e-9);
});
