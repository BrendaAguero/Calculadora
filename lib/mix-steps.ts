import type { MixSettings } from './mixes';

// Explicación paso a paso de cómo salen las cantidades (para que se entienda de dónde viene cada número).
const f = (value: number, unit = '') => `${value.toLocaleString('es-AR', { maximumFractionDigits: value < 10 ? 1 : 0 })}${unit ? ` ${unit}` : ''}`;
const parts = (v: number) => v.toLocaleString('es-AR', { maximumFractionDigits: 2 });

export function mixSteps(name: string, s: MixSettings, moldMl: number, pieces: number): string[] {
  if (!(moldMl > 0)) return [];
  const volume = moldMl * pieces;
  const base = volume * s.density;
  const total = base * (1 + s.wastePercent / 100);
  const sum = s.components.reduce((acc, c) => acc + c.parts, 0) || 1;
  const ratio = s.components.map((c) => parts(c.parts)).join(' : ');
  const lines = [
    pieces > 1 ? `Molde de ${f(moldMl, 'ml')} × ${pieces} piezas = ${f(volume, 'ml')} para llenar.` : `Tu molde tiene ${f(volume, 'ml')} para llenar.`,
    `La mezcla de ${name.toLowerCase()} pesa ${parts(s.density)} g por cada ml (un poco más que el agua): ${f(volume, 'ml')} × ${parts(s.density)} = ${f(base, 'g')}.`,
  ];
  if (s.wastePercent > 0) lines.push(`Sumamos ${parts(s.wastePercent)} % por lo que queda en el vaso: ${f(total, 'g')} de mezcla.`);
  if (s.byVolume) {
    const ml = total / s.density;
    lines.push(`Tu proporción es ${ratio} por volumen: ${f(ml, 'ml')} divididos en ${parts(sum)} partes iguales de ${f(ml / sum, 'ml')}.`);
    for (const c of s.components) lines.push(`${c.label}: ${parts(c.parts)} × ${f(ml / sum, 'ml')} = ${f((ml * c.parts) / sum, 'ml')}.`);
  } else {
    lines.push(`Tu proporción es ${ratio} por peso: ${f(total, 'g')} divididos en ${parts(sum)} partes iguales de ${f(total / sum, 'g')}.`);
    for (const c of s.components) lines.push(`${c.label}: ${parts(c.parts)} × ${f(total / sum, 'g')} = ${f((total * c.parts) / sum, c.key === 'agua' ? 'ml' : 'g')}.`);
  }
  if (s.pigmentPercent > 0) lines.push(`Pigmento: el ${parts(s.pigmentPercent)} % de la mezcla = ${f((total * s.pigmentPercent) / 100, 'g')} (se agrega aparte).`);
  return lines;
}

export function yesoSteps(moldMl: number, pieces: number, waterPct: number, wastePct = 0): string[] {
  if (!(moldMl > 0)) return [];
  const volume = moldMl * pieces;
  const plaster = volume;
  const waste = (plaster * wastePct) / 100;
  const lines = [
    pieces > 1 ? `Molde de ${f(moldMl, 'ml')} × ${pieces} piezas = ${f(volume, 'ml')} para llenar.` : `Tu molde tiene ${f(volume, 'ml')} para llenar.`,
    `Para llenarlo hace falta más o menos 1 g de yeso por cada ml: ${f(plaster, 'g')} de yeso.`,
  ];
  if (waste > 0) lines.push(`Sumamos ${parts(wastePct)} % de merma: ${f(plaster + waste, 'g')} de yeso.`);
  lines.push(`El agua es el ${parts(waterPct)} % del peso del yeso: ${f(plaster, 'g')} × ${parts(waterPct)} % = ${f((plaster * waterPct) / 100, 'ml')} de agua.`);
  lines.push(`Echá el yeso de a poco sobre el agua (nunca al revés) y mezclá sin batir para que no entre aire.`);
  return lines;
}
