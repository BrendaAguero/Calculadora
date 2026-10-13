// Recetas de color: cuánto pigmento lleva cada cantidad de mezcla, para repetir el mismo color.
export type PigmentUnit = 'g' | 'gotas' | 'ml';
export type Pigment = { name: string; amount: number; unit: PigmentUnit };

export const PIGMENT_UNITS: { value: PigmentUnit; label: string }[] = [
  { value: 'g', label: 'gramos' },
  { value: 'gotas', label: 'gotas' },
  { value: 'ml', label: 'ml' },
];
export const COLOR_MATERIALS = ['Yeso', 'Resina', 'Jesmonite', 'Cemento', 'Otro'];

// Lleva cada pigmento a otra cantidad de mezcla. Las gotas se redondean a enteras (al menos 1);
// los gramos y ml, a décimas (centésimas si son menos de 1).
export function scalePigments(pigments: Pigment[], baseGrams: number, targetGrams: number): Pigment[] {
  if (!(baseGrams > 0) || !(targetGrams > 0)) return pigments.map((p) => ({ ...p, amount: 0 }));
  const factor = targetGrams / baseGrams;
  return pigments.map((p) => {
    const raw = p.amount * factor;
    const amount = p.unit === 'gotas' ? (p.amount > 0 ? Math.max(1, Math.round(raw)) : 0) : raw < 1 ? Math.round(raw * 100) / 100 : Math.round(raw * 10) / 10;
    return { ...p, amount };
  });
}

// Porcentaje de pigmento sobre la mezcla (solo para los que van en gramos).
export const pigmentPercent = (p: Pigment, baseGrams: number) => (p.unit === 'g' && baseGrams > 0 ? (p.amount / baseGrams) * 100 : null);

export function cleanPigments(value: unknown): Pigment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((p) => {
    const unit = ['g', 'gotas', 'ml'].includes(p?.unit) ? (p.unit as PigmentUnit) : 'g';
    const amount = Number(p?.amount);
    const name = String(p?.name ?? '').trim().slice(0, 60);
    return name && amount > 0 ? [{ name, amount, unit }] : [];
  }).slice(0, 12);
}
