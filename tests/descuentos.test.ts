// Pruebas de las sugerencias de códigos por fechas especiales. Correr con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nthWeekday, upcomingSuggestions } from '../lib/discount-suggestions.ts';

test('Día de la Madre (3.er domingo de octubre) y Día del Padre (3.er domingo de junio)', () => {
  assert.equal(nthWeekday(2026, 10, 0, 3).toISOString().slice(0, 10), '2026-10-18');
  assert.equal(nthWeekday(2027, 6, 0, 3).toISOString().slice(0, 10), '2027-06-20');
});

test('Desde fines de octubre sugiere CyberMonday, Black Friday y Navidad, en orden', () => {
  const list = upcomingSuggestions(new Date('2026-10-22T12:00:00Z'), 70);
  assert.deepEqual(list.map((s) => s.code), ['CYBER26', 'BLACK26', 'NAVIDAD26']);
  const navidad = list.find((s) => s.code === 'NAVIDAD26')!;
  assert.equal(navidad.start, '2026-12-01');
  assert.equal(navidad.end, '2026-12-25');
  const black = list.find((s) => s.code === 'BLACK26')!;
  assert.equal(black.eventDay, '2026-11-27');
});

test('Una fecha en curso empieza hoy y cruza de año', () => {
  const list = upcomingSuggestions(new Date('2026-12-30T12:00:00Z'), 10);
  const anio = list.find((s) => s.key === 'anio-nuevo-2027')!;
  assert.equal(anio.code, 'ANONUEVO27');
  assert.equal(anio.start, '2026-12-30');
  assert.equal(anio.end, '2027-01-08');
});
